import type {
    AdapterConfig,
    Criticality,
    MonitoringAdapter,
    NormalizedIncident,
    NormalizedProbe,
    ProbeStatus
} from '$lib/types';

/**
 * Modèles types de services pour générer des noms et configurations réalistes.
 */
interface ServiceBlueprint {
	name: string;
	group: string;
	criticality: Criticality;
	url: string;
}

const BLUEPRINTS: ServiceBlueprint[] = [
	{ name: 'API Gateway Prod', group: 'APIs', criticality: 'critical', url: 'https://api.kato.internal/v1' },
	{ name: 'Auth Service OAuth2', group: 'APIs', criticality: 'critical', url: 'https://auth.kato.internal/oauth' },
	{ name: 'Billing & Subscriptions', group: 'APIs', criticality: 'critical', url: 'https://billing.kato.internal' },
	{ name: 'User Management API', group: 'APIs', criticality: 'high', url: 'https://users.kato.internal/api' },
	{ name: 'Notification Service', group: 'APIs', criticality: 'medium', url: 'https://notify.kato.internal' },
	{ name: 'Search Service ES', group: 'APIs', criticality: 'high', url: 'https://search.kato.internal/_cluster' },
	{ name: 'Webhooks Dispatcher', group: 'APIs', criticality: 'medium', url: 'https://webhooks.kato.internal' },
	{ name: 'GraphQL Gateway', group: 'APIs', criticality: 'high', url: 'https://graphql.kato.internal' },

	{ name: 'PostgreSQL Master', group: 'Infrastructure', criticality: 'critical', url: 'postgresql://pg-master.internal:5432' },
	{ name: 'PostgreSQL Read Replica', group: 'Infrastructure', criticality: 'high', url: 'postgresql://pg-replica.internal:5432' },
	{ name: 'Redis Cache Cluster', group: 'Infrastructure', criticality: 'high', url: 'redis://redis-cluster.internal:6379' },
	{ name: 'RabbitMQ Message Broker', group: 'Infrastructure', criticality: 'medium', url: 'amqp://broker.internal:5672' },
	{ name: 'Kafka Event Bus', group: 'Infrastructure', criticality: 'high', url: 'kafka://kafka-1.internal:9092' },
	{ name: 'Kubernetes Ingress LB', group: 'Infrastructure', criticality: 'critical', url: 'https://k8s-lb.internal/healthz' },
	{ name: 'S3 Object Storage', group: 'Infrastructure', criticality: 'high', url: 'https://s3.eu-west-1.kato-storage.io' },
	{ name: 'DNS Primary Anycast', group: 'Infrastructure', criticality: 'critical', url: 'dns://ns1.kato-dns.net' },

	{ name: 'Customer Web App', group: 'Sites Web', criticality: 'high', url: 'https://app.kato.io' },
	{ name: 'Marketing Website', group: 'Sites Web', criticality: 'medium', url: 'https://kato.io' },
	{ name: 'Documentation Hub', group: 'Sites Web', criticality: 'low', url: 'https://docs.kato.io' },
	{ name: 'Public Status Page', group: 'Sites Web', criticality: 'critical', url: 'https://status.kato.io' },
	{ name: 'Admin Backoffice', group: 'Sites Web', criticality: 'medium', url: 'https://admin.kato.internal' },
	{ name: 'Developer Portal', group: 'Sites Web', criticality: 'low', url: 'https://developer.kato.io' },

	{ name: 'Worker Analytics Engine', group: 'Production', criticality: 'medium', url: 'https://workers.kato.internal/analytics' },
	{ name: 'Worker Log Ingestion', group: 'Production', criticality: 'high', url: 'https://workers.kato.internal/logs' },
	{ name: 'Worker Transaction Sync', group: 'Production', criticality: 'high', url: 'https://workers.kato.internal/sync' },
	{ name: 'Worker Email Delivery', group: 'Production', criticality: 'medium', url: 'https://workers.kato.internal/mailer' },
	{ name: 'CDN Edge Paris', group: 'Production', criticality: 'high', url: 'https://edge-par.kato-cdn.net/ping' },
	{ name: 'CDN Edge Frankfurt', group: 'Production', criticality: 'high', url: 'https://edge-fra.kato-cdn.net/ping' },
	{ name: 'CDN Edge London', group: 'Production', criticality: 'high', url: 'https://edge-lon.kato-cdn.net/ping' },
	{ name: 'Backup Snapshot Engine', group: 'Production', criticality: 'low', url: 'https://backup.kato.internal/status' },

	{ name: 'Staging API Gateway', group: 'Staging', criticality: 'low', url: 'https://api-staging.kato.dev' },
	{ name: 'Staging Web App', group: 'Staging', criticality: 'low', url: 'https://staging.kato.dev' },
	{ name: 'Staging Database', group: 'Staging', criticality: 'low', url: 'postgresql://pg-staging.internal:5432' },
	{ name: 'QA Testing Cluster', group: 'Staging', criticality: 'low', url: 'https://qa-cluster.kato.dev' }
];

const GROUPS = ['Production', 'Staging', 'Infrastructure', 'APIs', 'Sites Web'];
const CRITICALITIES: Criticality[] = ['critical', 'high', 'medium', 'low'];

/**
 * Adaptateur simulé (Mock) pour le développement et la validation visuelle.
 * Produit un ensemble configurable de sondes réalistes avec transitions dynamiques contrôlées.
 */
export class MockAdapter implements MonitoringAdapter {
	readonly name = 'mock';

	private config: AdapterConfig = {};
	private probeCount = 50;
	private probes: Map<string, NormalizedProbe> = new Map();
	private incidents: Map<string, NormalizedIncident> = new Map();
	private initialized = false;

	/**
	 * Initialise l'adaptateur avec la configuration fournie.
	 */
	initialize(config: AdapterConfig): Promise<void> {
		this.config = config;

		if (typeof config.count === 'number' && config.count > 0) {
			this.probeCount = Math.floor(config.count);
		} else if (typeof config.count === 'string') {
			const parsed = parseInt(config.count, 10);
			if (!isNaN(parsed) && parsed > 0) {
				this.probeCount = parsed;
			}
		}

		this.probes.clear();
		this.incidents.clear();
		this.generateInitialData();
		this.initialized = true;

		return Promise.resolve();
	}

	/**
	 * Récupère l'ensemble des sondes supervisées.
	 * À chaque appel, les sondes conservent leur état avec une probabilité de ~5%
	 * d'évolution de statut pour simuler une activité dynamique réaliste.
	 */
	async fetchProbes(): Promise<NormalizedProbe[]> {
		if (!this.initialized) {
			this.generateInitialData();
			this.initialized = true;
		} else {
			this.simulateLiveCycle();
		}

		return Array.from(this.probes.values());
	}

	/**
	 * Récupère les incidents enregistrés depuis la date spécifiée.
	 * Retourne les incidents actifs ainsi que ceux résolus dans l'intervalle.
	 */
	async fetchIncidents(since: Date): Promise<NormalizedIncident[]> {
		const sinceTime = since.getTime();
		const list: NormalizedIncident[] = [];

		for (const incident of this.incidents.values()) {
			const startedTime = new Date(incident.startedAt).getTime();
			// Toujours inclure les incidents actifs non résolus
			if (incident.resolvedAt === null) {
				list.push({ ...incident });
				continue;
			}

			const resolvedTime = new Date(incident.resolvedAt).getTime();
			if (startedTime >= sinceTime || resolvedTime >= sinceTime) {
				list.push({ ...incident });
			}
		}

		// Tri antéchronologique (les plus récents en premier)
		return list.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
	}

	/**
	 * Intervalle de rafraîchissement recommandé (5 secondes pour le dev).
	 */
	getPollingInterval(): number {
		return 5000;
	}

	// ============================================================================
	// MÉTHODES PRIVÉES DE GÉNÉRATION ET SIMULATION
	// ============================================================================

	/**
	 * Génère l'état initial des sondes et quelques incidents historiques.
	 */
	private generateInitialData(): void {
		const now = Date.now();

		for (let i = 1; i <= this.probeCount; i++) {
			const id = `mock:${i}`;
			const blueprint = this.resolveBlueprint(i);
			const status = this.resolveInitialStatus(i);
			const responseTime = this.computeResponseTime(status);
			const uptime24h = this.computeUptime(status, i * 7);
			const uptime7d = this.computeUptime(status, i * 13);

			const probe: NormalizedProbe = {
				id,
				source: this.name,
				name: blueprint.name,
				url: blueprint.url,
				status,
				responseTime,
				uptime24h,
				uptime7d,
				lastCheck: new Date(now).toISOString(),
				group: blueprint.group,
				criticality: blueprint.criticality
			};

			this.probes.set(id, probe);

			// Créer un incident actif pour les sondes initialement DOWN
			if (status === 'down') {
				const incidentId = `inc:${id}:${now - 600000}`;
				this.incidents.set(incidentId, {
					id: incidentId,
					probeId: id,
					probeName: probe.name,
					type: 'down',
					startedAt: new Date(now - 10 * 60 * 1000).toISOString(), // Il y a 10 min
					resolvedAt: null,
					duration: null
				});
			}
		}

		// Injecter 1 ou 2 incidents déjà résolus dans les dernières 24h pour enrichir le dashboard
		const probeOne = this.probes.get('mock:1') ?? Array.from(this.probes.values())[0];
		if (probeOne) {
			const pastIncidentId = `inc:${probeOne.id}:${now - 7200000}`;
			this.incidents.set(pastIncidentId, {
				id: pastIncidentId,
				probeId: probeOne.id,
				probeName: probeOne.name,
				type: 'down',
				startedAt: new Date(now - 2 * 3600 * 1000).toISOString(),
				resolvedAt: new Date(now - (2 * 3600 - 320) * 1000).toISOString(),
				duration: 320
			});
		}
	}

	/**
	 * Détermine les métadonnées de la sonde (nom, groupe, URL, criticité).
	 */
	private resolveBlueprint(index: number): ServiceBlueprint {
		if (index <= BLUEPRINTS.length) {
			return BLUEPRINTS[index - 1];
		}

		// Génération procédurale au-delà des blueprints statiques
		const group = GROUPS[index % GROUPS.length];
		const criticality = CRITICALITIES[index % CRITICALITIES.length];
		const name = `${group} Service #${index}`;
		const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

		return {
			name,
			group,
			criticality,
			url: `https://${slug}.kato.internal`
		};
	}

	/**
	 * Détermine le statut initial selon la distribution demandée :
	 * ~90% up, ~3% degraded, ~2% down, ~3% paused, ~2% pending.
	 */
	private resolveInitialStatus(index: number): ProbeStatus {
		const mod = index % 50;

		if (mod === 12) {
			return 'down'; // ~2% (1/50)
		}
		if (mod === 3 || mod === 28) {
			return 'degraded'; // ~4% (2/50)
		}
		if (mod === 8 || mod === 44) {
			return 'paused'; // ~4% (2/50)
		}
		if (mod === 23) {
			return 'pending'; // ~2% (1/50)
		}

		return 'up'; // ~88%
	}

	/**
	 * Calcule un temps de réponse réaliste en fonction du statut.
	 */
	private computeResponseTime(status: ProbeStatus): number | null {
		if (status === 'down' || status === 'paused' || status === 'pending') {
			return null;
		}

		if (status === 'degraded') {
			// Dégradation : latence élevée entre 350ms et 500ms
			return Math.floor(350 + Math.random() * 150);
		}

		// Statut UP : latence nominale entre 50ms et 250ms
		return Math.floor(50 + Math.random() * 200);
	}

	/**
	 * Calcule un pourcentage d'uptime réaliste entre 95.00% et 100.00%.
	 */
	private computeUptime(status: ProbeStatus, seedOffset: number): number {
		const base = status === 'down' ? 96.2 : status === 'degraded' ? 97.8 : 99.4;
		const variance = ((seedOffset % 17) / 17) * 0.6;
		const finalValue = Math.min(100, Math.max(95, base + variance));
		return Math.round(finalValue * 100) / 100;
	}

	/**
	 * Simule le cycle de vie : ~5% de chance de transition par sonde et micro-variations.
	 */
	private simulateLiveCycle(): void {
		const now = Date.now();
		const nowIso = new Date(now).toISOString();

		for (const probe of this.probes.values()) {
			probe.lastCheck = nowIso;

			// 5% de chance de changement de statut
			if (Math.random() < 0.05) {
				const oldStatus = probe.status;
				const newStatus = this.pickNextStatus(oldStatus);

				if (oldStatus !== newStatus) {
					probe.status = newStatus;
					probe.responseTime = this.computeResponseTime(newStatus);

					// Gestion des incidents liés aux transitions
					if (newStatus === 'down' && oldStatus !== 'down') {
						const incidentId = `inc:${probe.id}:${now}`;
						this.incidents.set(incidentId, {
							id: incidentId,
							probeId: probe.id,
							probeName: probe.name,
							type: 'down',
							startedAt: nowIso,
							resolvedAt: null,
							duration: null
						});
					} else if (oldStatus === 'down' && newStatus !== 'down') {
						// Clôturer l'incident actif
						for (const incident of this.incidents.values()) {
							if (incident.probeId === probe.id && incident.resolvedAt === null) {
								incident.resolvedAt = nowIso;
								const durationSec = Math.max(
									1,
									Math.round((now - new Date(incident.startedAt).getTime()) / 1000)
								);
								incident.duration = durationSec;
							}
						}
					}
				}
			} else if (probe.status === 'up' || probe.status === 'degraded') {
				// Micro-variation de latence pour sondes actives
				if (probe.responseTime !== null) {
					const delta = (Math.random() - 0.5) * 30; // ±15ms
					const updated = Math.round(probe.responseTime + delta);
					probe.responseTime = Math.min(500, Math.max(50, updated));
				}
			}
		}
	}

	/**
	 * Choisit le prochain statut lors d'une transition.
	 */
	private pickNextStatus(current: ProbeStatus): ProbeStatus {
		const roll = Math.random();

		switch (current) {
			case 'down':
				// Forte probabilité de rétablissement
				return roll < 0.8 ? 'up' : 'degraded';
			case 'degraded':
				// Rétablissement vers UP, bascule en DOWN ou persistance
				return roll < 0.7 ? 'up' : roll < 0.9 ? 'down' : 'degraded';
			case 'paused':
				return roll < 0.6 ? 'up' : 'paused';
			case 'pending':
				return roll < 0.8 ? 'up' : 'pending';
			case 'maintenance':
				return roll < 0.7 ? 'up' : 'maintenance';
			case 'up':
			default:
				// Dégradation ou panne ponctuelle
				return roll < 0.5 ? 'degraded' : roll < 0.8 ? 'down' : 'paused';
		}
	}
}

export default MockAdapter;
