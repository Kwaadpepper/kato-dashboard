import type {
    AdapterConfig,
    MonitoringAdapter,
    NormalizedIncident,
    NormalizedProbe,
    ProbeStatus
} from '$lib/types';

/**
 * Monitor structure returned by Uptime Robot REST API v3 (GET /monitors).
 */
interface URMonitor {
	id: number | string;
	friendly_name?: string;
	friendlyName?: string;
	name?: string;
	url?: string;
	type?: number | string;
	status: number | string;
	interval?: number;
	create_datetime?: string;
	createDateTime?: string;
}

/**
 * Pagination structure and response envelope for Uptime Robot v3.
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
 * Metadata for an active incident tracked in memory.
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
 * Uptime Robot v3 adapter for Kato Dashboard.
 *
 * Implements MonitoringAdapter:
 * - Bearer token authentication via UPTIMEROBOT_API_KEY
 * - Cursor-based pagination on GET /monitors
 * - Zero individual log requests per poll cycle to conserve quotas (Free plan: 10 req/min)
 * - In-memory outage tracking (active and resolved incidents)
 * - Fault tolerance: 401 captured without crash, backoff on 429, retry on timeout >10s, preserve last state on network failure
 */
export class UptimeRobotAdapter implements MonitoringAdapter {
	readonly name: string;
	readonly type = 'uptimerobot';

	private config: AdapterConfig = {};
	private apiKey = '';
	private baseUrl = 'https://api.uptimerobot.com/v3';

	constructor(name = 'uptimerobot') {
		this.name = name;
	}

	private get idPrefix(): string {
		return this.name === 'uptimerobot' ? 'ur' : this.name;
	}

	/** Last known probes cache (served on network outage) */
	private cachedProbes: Map<string, NormalizedProbe> = new Map();

	/** In-memory active incidents registry (currently DOWN monitors) to preserve startedAt */
	private downMonitors: Map<string, ActiveIncidentInfo> = new Map();

	/** Rolling history of resolved incidents (max 24h) */
	private resolvedIncidents: NormalizedIncident[] = [];

	/**
	 * Initializes adapter with provided configuration.
	 *
	 * - Reads API key from config.apiKey or process.env.UPTIMEROBOT_API_KEY
	 * - Throws explicit error if key is missing
	 * - Validates key with GET /monitors?per_page=1
	 * - Logs total monitors count found
	 */
	async initialize(config: AdapterConfig): Promise<void> {
		this.config = config;

		const apiKey = String(config.apiKey || process.env.UPTIMEROBOT_API_KEY || '').trim();
		if (!apiKey) {
			throw new Error('Missing configuration: UPTIMEROBOT_API_KEY is required.');
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
				(res.pagination?.has_more ? '>= 1' : res.data?.length ?? 0);
			console.log(`[UptimeRobot] API key validated. Total monitors found: ${total}`);
		} catch (err: unknown) {
			const reqErr = err as RequestError;
			if (reqErr?.isAuthError || reqErr?.status === 401) {
				// Do not crash the process
				return;
			}
			console.warn(
				'[UptimeRobot] Warning during initial validation:',
				reqErr?.message || String(err)
			);
		}
	}

	/**
	 * Fetches all probes querying GET /monitors with cursor pagination.
	 * Converts each monitor into a NormalizedProbe.
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
				const probeId = `${this.idPrefix}:${m.id}`;
				const status = this.mapStatus(m.status);
				const rawName = m.friendlyName || m.friendly_name || m.name || m.url || '';
				const { group, name } = this.parseNameAndGroup(rawName);

				if (status === 'down') {
					currentDownProbeIds.add(probeId);
					if (!this.downMonitors.has(probeId)) {
						this.downMonitors.set(probeId, {
							incidentId: `${this.idPrefix}:inc:${m.id}:${Date.now()}`,
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

			// Cleanup if a DOWN monitor was removed from Uptime Robot
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
				// 401 error message already logged by request()
			} else if (reqErr?.isTimeout) {
				console.warn(
					'[UptimeRobot] Timeout (>10s) reached during polling, preserving last known state.'
				);
			} else {
				console.warn(
					'[UptimeRobot] Network down or API error, preserving last known state:',
					reqErr?.message || String(err)
				);
			}
			return Array.from(this.cachedProbes.values());
		}
	}

	/**
	 * Returns list of active incidents (DOWN monitors) and recent resolved incidents.
	 *
	 * Does NOT make HTTP requests to individual logs endpoints to avoid exhausting API quotas
	 * (especially Free plan: 10 req/min).
	 */
	async fetchIncidents(since: Date): Promise<NormalizedIncident[]> {
		const sinceMs = since.getTime();
		const incidents: NormalizedIncident[] = [];

		// 1. Currently active incidents (DOWN)
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

		// 2. Resolved incidents since `since`
		for (const resolved of this.resolvedIncidents) {
			const startedMs = new Date(resolved.startedAt).getTime();
			const resolvedMs = resolved.resolvedAt ? new Date(resolved.resolvedAt).getTime() : 0;
			if (startedMs >= sinceMs || resolvedMs >= sinceMs) {
				incidents.push({ ...resolved });
			}
		}

		// Purge resolved incidents older than 24h
		const cutoff24h = Date.now() - 24 * 60 * 60 * 1000;
		this.resolvedIncidents = this.resolvedIncidents.filter((inc) => {
			if (!inc.resolvedAt) return true;
			return new Date(inc.resolvedAt).getTime() >= cutoff24h;
		});

		// Reverse chronological order (most recent first)
		return incidents.sort(
			(a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
		);
	}

	/**
	 * Fetches recent incident history for a probe via GET /monitors/{id}/logs
	 * with fallback to memory on error or rate-limiting.
	 */
	async fetchProbeHistory(probeId: string): Promise<NormalizedIncident[]> {
		const numericId = probeId.replace(`${this.idPrefix}:`, '');
		const sinceMs = Date.now() - 24 * 60 * 60 * 1000;
		const sinceIso = new Date(sinceMs).toISOString();
		const incidents: NormalizedIncident[] = [];

		// Get probe name from cache
		const probeName = this.cachedProbes.get(probeId)?.name || probeId;

		// 1. Attempt to fetch remote logs from Uptime Robot API
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
						id: `${this.idPrefix}:inc:${numericId}:${startMs}`,
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
			console.warn(`[UptimeRobot] Failed to fetch remote logs for ${probeId}:`, err);
		}

		// 2. Merge with active ongoing incident if one exists in memory
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
				cause: 'Confirmed ongoing outage'
			});
		}

		// If no incidents found via API, include in-memory resolved incidents
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
	 * Recommended polling interval in milliseconds.
	 * Reads UPTIMEROBOT_POLL_INTERVAL or defaults to 30000 (30s).
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
	// PRIVATE METHODS (PARSING, STATUS MAPPING, HTTP WITH BACKOFF/RETRY)
	// ============================================================================

	/**
	 * Parses friendly name with optional "[Group] Name" convention.
	 * If present, extracts group and cleans name; otherwise group = null.
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
	 * Maps Uptime Robot v3 numeric status codes to Kato ProbeStatus:
	 * 0 -> paused
	 * 1 -> pending
	 * 2 -> up
	 * 8 -> degraded
	 * 9 -> down
	 */
	private mapStatus(status: number | string): ProbeStatus {
		if (typeof status === 'string') {
			const normalized = status.trim().toUpperCase();
			switch (normalized) {
				case 'UP':
				case '2':
					return 'up';
				case 'DOWN':
				case '9':
					return 'down';
				case 'PAUSED':
				case '0':
					return 'paused';
				case 'PENDING':
				case '1':
					return 'pending';
				case 'DEGRADED':
				case '8':
					return 'degraded';
				default:
					return 'up';
			}
		}

		switch (status) {
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
				return 'up';
		}
	}

	/**
	 * Executes an HTTP GET request to Uptime Robot API v3 with:
	 * - 401: Logs "Invalid API key", does not crash
	 * - 429: Exponential backoff (60s, 120s, 240s)
	 * - Timeout >10s: 1 immediate retry then skipped
	 * - Network down: Warning log and error propagated for cache fallback
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
				console.error('[UptimeRobot] Invalid API key');
				const err = new Error('Invalid API key') as RequestError;
				err.status = 401;
				err.isAuthError = true;
				throw err;
			}

			if (response.status === 429) {
				console.warn(`[UptimeRobot] Rate limit 429 received on ${path}. Attempt ${attempt}/3`);
				if (attempt <= 3) {
					const delays = [60_000, 120_000, 240_000];
					const delay = delays[attempt - 1] ?? 240_000;
					console.warn(
						`[UptimeRobot] Exponential backoff: waiting ${delay / 1000}s before retrying...`
					);
					await new Promise((resolve) => setTimeout(resolve, delay));
					return this.request<T>(path, attempt + 1);
				}
				const err = new Error('429 Too Many Requests: Rate limit exceeded after 3 retries') as RequestError;
				err.status = 429;
				throw err;
			}

			if (!response.ok) {
				throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
			}

			return (await response.json()) as URResponse<T>;
		} catch (err: unknown) {
			clearTimeout(timeoutId);

			const reqErr = err as RequestError;
			if (reqErr?.name === 'AbortError' || controller.signal.aborted) {
				if (attempt === 1) {
					console.warn(
						`[UptimeRobot] Timeout (>10s) reached on ${path}. Retrying (1/1)...`
					);
					return this.request<T>(path, 2);
				}
				console.warn(`[UptimeRobot] Second consecutive timeout (>10s) on ${path}. Request skipped.`);
				const timeoutErr = new Error('Timeout >10s') as RequestError;
				timeoutErr.isTimeout = true;
				throw timeoutErr;
			}

			throw err;
		}
	}
}

export default UptimeRobotAdapter;
