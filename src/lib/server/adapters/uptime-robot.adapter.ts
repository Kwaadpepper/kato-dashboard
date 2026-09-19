import type {
	AdapterConfig,
	MonitoringAdapter,
	NormalizedIncident,
	NormalizedProbe,
	ProbeStatus
} from '$lib/types';

/**
 * Structure d'un moniteur retourné par l'API REST v3 d'Uptime Robot (GET /monitors).
 */
interface URMonitor {
	id: number | string;
	friendly_name: string;
	url?: string;
	type?: number;
	status: number;
	interval?: number;
	create_datetime?: string;
}

/**
 * Structure de pagination et enveloppe de réponse Uptime Robot v3.
 */
interface URResponse<T> {
	data: T;
	pagination?: {
		next_cursor?: string;
		has_more: boolean;
		total?: number;
		total_monitors?: number;
	};
	error?: {
		message: string;
	};
}

/**
 * Métadonnées d'un incident en cours suivi en mémoire.
 */
interface ActiveIncidentInfo {
	incidentId: string;
	startedAt: string;
	probeName: string;
}

interface RequestError extends Error {
	status?: number;
	isAuthError?: boolean;
	isTimeout?: boolean;
}

/**
 * Adaptateur Uptime Robot v3 pour Kato Dashboard.
 *
 * Implémente le contrat MonitoringAdapter :
 * - Authentification Bearer token via UPTIMEROBOT_API_KEY
 * - Pagination par curseur sur GET /monitors
 * - Zéro requête individuelle de logs par cycle de poll pour préserver les quotas (plan Free: 10 req/min)
 * - Suivi in-memory de la date de début des pannes (incidents actifs et résolus)
 * - Tolérance aux pannes : 401 capturé sans crash, backoff sur 429, retry sur timeout >10s, conservation du dernier état en cas de coupure réseau
 */
export class UptimeRobotAdapter implements MonitoringAdapter {
	readonly name = 'uptimerobot';

	private config: AdapterConfig = {};
	private apiKey = '';
	private baseUrl = 'https://api.uptimerobot.com/v3';

	/** Cache du dernier état connu des sondes (servi en cas de coupure réseau) */
	private cachedProbes: Map<string, NormalizedProbe> = new Map();

	/** Registre mémoire des incidents actifs (sondes actuellement DOWN) pour préserver startedAt */
	private downMonitors: Map<string, ActiveIncidentInfo> = new Map();

	/** Historique glissant des incidents résolus (max 24h) */
	private resolvedIncidents: NormalizedIncident[] = [];

	/**
	 * Initialise l'adaptateur avec la configuration passée.
	 *
	 * - Lit l'API key depuis config.apiKey ou process.env.UPTIMEROBOT_API_KEY
	 * - Lève une exception explicite si la clé est manquante
	 * - Valide la clé avec GET /monitors?per_page=1
	 * - Log le nombre total de monitors trouvés
	 */
	async initialize(config: AdapterConfig): Promise<void> {
		this.config = config;

		const apiKey = String(config.apiKey || process.env.UPTIMEROBOT_API_KEY || '').trim();
		if (!apiKey) {
			throw new Error('Configuration manquante : UPTIMEROBOT_API_KEY est requise.');
		}
		this.apiKey = apiKey;

		if (config.baseUrl && typeof config.baseUrl === 'string') {
			this.baseUrl = config.baseUrl;
		} else if (process.env.UPTIMEROBOT_BASE_URL) {
			this.baseUrl = process.env.UPTIMEROBOT_BASE_URL;
		}

		try {
			const res = await this.request<URMonitor[]>('/monitors?per_page=1');
			const total =
				res.pagination?.total ??
				res.pagination?.total_monitors ??
				(res.pagination?.has_more ? '≥ 1' : res.data?.length ?? 0);
			console.log(`[UptimeRobot] Clé API validée. Nombre total de monitors trouvés : ${total}`);
		} catch (err: unknown) {
			const reqErr = err as RequestError;
			if (reqErr?.isAuthError || reqErr?.status === 401) {
				// Ne pas crasher le processus
				return;
			}
			console.warn(
				'[UptimeRobot] Avertissement lors de la validation initiale :',
				reqErr?.message || String(err)
			);
		}
	}

	/**
	 * Récupère l'ensemble des sondes en interrogeant GET /monitors avec pagination par curseur.
	 * Transforme chaque moniteur en NormalizedProbe.
	 */
	async fetchProbes(): Promise<NormalizedProbe[]> {
		try {
			const monitors: URMonitor[] = [];
			let cursor: string | undefined = undefined;
			let hasMore = true;

			while (hasMore) {
				const endpoint: string = cursor
					? `/monitors?per_page=100&cursor=${encodeURIComponent(cursor)}`
					: `/monitors?per_page=100`;

				const response: URResponse<URMonitor[]> = await this.request<URMonitor[]>(endpoint);
				if (Array.isArray(response.data)) {
					monitors.push(...response.data);
				}

				hasMore = Boolean(response.pagination?.has_more);
				cursor = response.pagination?.next_cursor;
				if (!cursor) {
					hasMore = false;
				}
			}

			const nowIso = new Date().toISOString();
			const newProbesMap = new Map<string, NormalizedProbe>();
			const currentDownProbeIds = new Set<string>();

			for (const m of monitors) {
				const probeId = `ur:${m.id}`;
				const status = this.mapStatus(m.status);
				const { group, name } = this.parseNameAndGroup(m.friendly_name);

				if (status === 'down') {
					currentDownProbeIds.add(probeId);
					if (!this.downMonitors.has(probeId)) {
						this.downMonitors.set(probeId, {
							incidentId: `ur:inc:${m.id}:${Date.now()}`,
							startedAt: nowIso,
							probeName: name
						});
					}
				} else {
					if (this.downMonitors.has(probeId)) {
						const downInfo = this.downMonitors.get(probeId)!;
						const startMs = new Date(downInfo.startedAt).getTime();
						const nowMs = new Date(nowIso).getTime();
						const duration = Math.max(1, Math.round((nowMs - startMs) / 1000));

						this.resolvedIncidents.push({
							id: downInfo.incidentId,
							probeId,
							probeName: downInfo.probeName,
							type: 'down',
							startedAt: downInfo.startedAt,
							resolvedAt: nowIso,
							duration
						});
						this.downMonitors.delete(probeId);
					}
				}

				const downSince = this.downMonitors.get(probeId)?.startedAt;

				const probe: NormalizedProbe = {
					id: probeId,
					source: this.name,
					name,
					url: m.url || '',
					status,
					responseTime: null,
					uptime24h: null,
					uptime7d: null,
					lastCheck: nowIso,
					group,
					criticality: 'medium',
					...(downSince ? { downSince } : {})
				};

				newProbesMap.set(probeId, probe);
			}

			// Nettoyage si un moniteur DOWN a disparu du parc
			for (const downId of this.downMonitors.keys()) {
				if (!currentDownProbeIds.has(downId)) {
					this.downMonitors.delete(downId);
				}
			}

			this.cachedProbes = newProbesMap;
			return Array.from(this.cachedProbes.values());
		} catch (err: unknown) {
			const reqErr = err as RequestError;
			if (reqErr?.isAuthError || reqErr?.status === 401) {
				// Le message d'erreur 401 a déjà été loggé par request()
			} else if (reqErr?.isTimeout) {
				console.warn(
					'[UptimeRobot] Timeout (>10s) atteint lors du polling, conservation du dernier état.'
				);
			} else {
				console.warn(
					'[UptimeRobot] Réseau down ou erreur API, conservation du dernier état :',
					reqErr?.message || String(err)
				);
			}
			return Array.from(this.cachedProbes.values());
		}
	}

	/**
	 * Retourne la liste des incidents actifs (sondes DOWN) et résolus récents.
	 *
	 * Ne fait AUCUN appel HTTP vers les endpoints de logs individuels pour
	 * ne pas épuiser le quota d'appels API (notamment plan Free: 10 req/min).
	 */
	async fetchIncidents(since: Date): Promise<NormalizedIncident[]> {
		const sinceMs = since.getTime();
		const incidents: NormalizedIncident[] = [];

		// 1. Incidents actuellement actifs (DOWN)
		for (const [probeId, downInfo] of this.downMonitors.entries()) {
			incidents.push({
				id: downInfo.incidentId,
				probeId,
				probeName: downInfo.probeName,
				type: 'down',
				startedAt: downInfo.startedAt,
				resolvedAt: null,
				duration: null
			});
		}

		// 2. Incidents résolus depuis `since`
		for (const resolved of this.resolvedIncidents) {
			const startedMs = new Date(resolved.startedAt).getTime();
			const resolvedMs = resolved.resolvedAt ? new Date(resolved.resolvedAt).getTime() : 0;
			if (startedMs >= sinceMs || resolvedMs >= sinceMs) {
				incidents.push({ ...resolved });
			}
		}

		// Purge des incidents résolus plus vieux que 24h
		const cutoff24h = Date.now() - 24 * 60 * 60 * 1000;
		this.resolvedIncidents = this.resolvedIncidents.filter((inc) => {
			if (!inc.resolvedAt) return true;
			return new Date(inc.resolvedAt).getTime() >= cutoff24h;
		});

		// Tri antéchronologique (les plus récents en tête)
		return incidents.sort(
			(a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
		);
	}

	/**
	 * Récupère l'historique récent d'une sonde spécifique via GET /monitors/{id}/logs
	 * avec repli sur la mémoire en cas d'erreur ou d'épuisement de quota.
	 */
	async fetchProbeHistory(probeId: string): Promise<NormalizedIncident[]> {
		const numericId = probeId.replace('ur:', '');
		const sinceMs = Date.now() - 24 * 60 * 60 * 1000;
		const sinceIso = new Date(sinceMs).toISOString();
		const incidents: NormalizedIncident[] = [];

		// Récupérer le nom de la sonde depuis le cache
		const probeName = this.cachedProbes.get(probeId)?.name || probeId;

		// 1. Tenter la récupération des logs officiels depuis l'API Uptime Robot
		try {
			const response = await this.request<
				Array<{
					type: number;
					datetime: string;
					duration?: number;
					reason?: { code?: string | number; detail?: string };
				}>
			>(`/monitors/${numericId}/logs`);

			if (Array.isArray(response.data)) {
				const downLogs = response.data.filter(
					(log) => log.type === 1 && log.datetime >= sinceIso
				);

				for (const log of downLogs) {
					const startMs = new Date(log.datetime).getTime();
					const duration = typeof log.duration === 'number' && log.duration > 0 ? log.duration : null;
					const resolvedAt = duration
						? new Date(startMs + duration * 1000).toISOString()
						: null;

					const causeDetail = log.reason?.detail || '';
					const causeCode = log.reason?.code ? String(log.reason.code) : '';
					const cause = causeCode || causeDetail ? `${causeCode}${causeCode && causeDetail ? ' - ' : ''}${causeDetail}` : undefined;

					incidents.push({
						id: `ur:inc:${numericId}:${startMs}`,
						probeId,
						probeName,
						type: 'down',
						startedAt: log.datetime,
						resolvedAt,
						duration,
						cause
					});
				}
			}
		} catch (err) {
			console.warn(`[UptimeRobot] Impossible de récupérer les logs distants pour ${probeId} :`, err);
		}

		// 2. Fusionner avec l'incident actif en cours s'il existe en mémoire
		const active = this.downMonitors.get(probeId);
		if (active && !incidents.some((i) => i.resolvedAt === null)) {
			incidents.unshift({
				id: active.incidentId,
				probeId,
				probeName: active.probeName,
				type: 'down',
				startedAt: active.startedAt,
				resolvedAt: null,
				duration: null,
				cause: 'Panne confirmée en cours'
			});
		}

		// Si aucun incident récupéré via l'API, inclure les incidents résolus en mémoire
		if (incidents.length === 0) {
			for (const resolved of this.resolvedIncidents) {
				if (resolved.probeId === probeId) {
					incidents.push({ ...resolved });
				}
			}
		}

		return incidents.sort(
			(a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
		);
	}

	/**
	 * Intervalle de rafraîchissement recommandé en millisecondes.
	 * Lit UPTIMEROBOT_POLL_INTERVAL ou retourne 30000 (30s) par défaut.
	 */
	getPollingInterval(): number {
		const envVal = process.env.UPTIMEROBOT_POLL_INTERVAL;
		if (envVal) {
			const parsed = parseInt(envVal, 10);
			if (!isNaN(parsed) && parsed > 0) {
				return parsed;
			}
		}

		if (typeof this.config.pollInterval === 'number' && this.config.pollInterval > 0) {
			return this.config.pollInterval;
		}

		return 30000;
	}

	// ============================================================================
	// MÉTHODES PRIVÉES (PARSING, STATUS MAPPING, HTTP AVEC BACKOFF/RETRY)
	// ============================================================================

	/**
	 * Découpe le nom convivial selon la convention "[Groupe] Nom".
	 * Si présent, extrait le groupe et nettoie le nom ; sinon group = null.
	 */
	private parseNameAndGroup(friendlyName: string): { group: string | null; name: string } {
		const trimmed = (friendlyName || '').trim();
		const match = trimmed.match(/^\[(.*?)\]\s*(.*)$/);

		if (match) {
			const group = match[1].trim();
			const name = match[2].trim();
			return {
				group: group || null,
				name: name || trimmed
			};
		}

		return {
			group: null,
			name: trimmed
		};
	}

	/**
	 * Mappe les statuts numériques de l'API v3 vers ProbeStatus Kato :
	 * 0 → paused
	 * 1 → pending
	 * 2 → up
	 * 8 → degraded
	 * 9 → down
	 */
	private mapStatus(statusCode: number): ProbeStatus {
		switch (statusCode) {
			case 0:
				return 'paused';
			case 1:
				return 'pending';
			case 2:
				return 'up';
			case 8:
				return 'degraded';
			case 9:
				return 'down';
			default:
				return 'degraded';
		}
	}

	/**
	 * Exécute une requête HTTP GET vers l'API v3 Uptime Robot avec gestion :
	 * - 401 : Log "API key invalide", ne crashe pas
	 * - 429 : Backoff exponentiel (60s, 120s, 240s)
	 * - Timeout >10s : 1 retry immédiat puis skip (throw capturé)
	 * - Réseau down : Log warning et propagation pour fallback sur cache
	 */
	private async request<T>(path: string, attempt = 1): Promise<URResponse<T>> {
		const url = `${this.baseUrl}${path}`;
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), 10_000);

		try {
			const response = await fetch(url, {
				method: 'GET',
				headers: {
					Authorization: `Bearer ${this.apiKey}`,
					Accept: 'application/json'
				},
				signal: controller.signal
			});

			clearTimeout(timeoutId);

			if (response.status === 401) {
				console.error('[UptimeRobot] API key invalide');
				const err = new Error('API key invalide') as RequestError;
				err.status = 401;
				err.isAuthError = true;
				throw err;
			}

			if (response.status === 429) {
				console.warn(`[UptimeRobot] Rate limit 429 reçu sur ${path}. Tentative ${attempt}/3`);
				if (attempt <= 3) {
					const delays = [60_000, 120_000, 240_000];
					const delay = delays[attempt - 1] ?? 240_000;
					console.warn(
						`[UptimeRobot] Backoff exponentiel : attente de ${delay / 1000}s avant réessai...`
					);
					await new Promise((resolve) => setTimeout(resolve, delay));
					return this.request<T>(path, attempt + 1);
				}
				const err = new Error('429 Too Many Requests: Limite atteinte après 3 retries') as RequestError;
				err.status = 429;
				throw err;
			}

			if (!response.ok) {
				throw new Error(`Erreur HTTP ${response.status}: ${response.statusText}`);
			}

			return (await response.json()) as URResponse<T>;
		} catch (err: unknown) {
			clearTimeout(timeoutId);

			const reqErr = err as RequestError;
			if (reqErr?.name === 'AbortError' || controller.signal.aborted) {
				if (attempt === 1) {
					console.warn(
						`[UptimeRobot] Timeout (>10s) atteint sur ${path}. Nouvelle tentative (1/1)...`
					);
					return this.request<T>(path, 2);
				}
				console.warn(`[UptimeRobot] Second timeout (>10s) consécutif sur ${path}. Requête ignorée.`);
				const timeoutErr = new Error('Timeout >10s') as RequestError;
				timeoutErr.isTimeout = true;
				throw timeoutErr;
			}

			throw err;
		}
	}
}

export default UptimeRobotAdapter;
