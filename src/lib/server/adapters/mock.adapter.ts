import type {
    AdapterConfig,
    Criticality,
    MonitoringAdapter,
    NormalizedIncident,
    NormalizedProbe,
    ProbeStatus
} from '$lib/types';

/**
 * Service blueprints to generate realistic names and configurations.
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

	{ name: 'Customer Web App', group: 'Websites', criticality: 'high', url: 'https://app.kato.io' },
	{ name: 'Marketing Website', group: 'Websites', criticality: 'medium', url: 'https://kato.io' },
	{ name: 'Documentation Hub', group: 'Websites', criticality: 'low', url: 'https://docs.kato.io' },
	{ name: 'Public Status Page', group: 'Websites', criticality: 'critical', url: 'https://status.kato.io' },
	{ name: 'Admin Backoffice', group: 'Websites', criticality: 'medium', url: 'https://admin.kato.internal' },
	{ name: 'Developer Portal', group: 'Websites', criticality: 'low', url: 'https://developer.kato.io' },

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

const GROUPS = ['Production', 'Staging', 'Infrastructure', 'APIs', 'Websites'];
const CRITICALITIES: Criticality[] = ['critical', 'high', 'medium', 'low'];

/**
 * Mock monitoring adapter for development and visual validation.
 * Produces a configurable set of realistic probes with controlled dynamic transitions.
 */
export class MockAdapter implements MonitoringAdapter {
	readonly name = 'mock';

	private config: AdapterConfig = {};
	private probeCount = 50;
	private probes: Map<string, NormalizedProbe> = new Map();
	private incidents: Map<string, NormalizedIncident> = new Map();
	private initialized = false;

	/**
	 * Initializes adapter with provided configuration.
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
	 * Fetches all monitored probes.
	 * Probes hold their state with a ~5% transition probability per poll
	 * to simulate realistic activity.
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
	 * Fetches recorded incidents since the specified timestamp.
	 * Returns active incidents and those resolved in the timeframe.
	 */
	async fetchIncidents(since: Date): Promise<NormalizedIncident[]> {
		const sinceTime = since.getTime();
		const list: NormalizedIncident[] = [];

		for (const incident of this.incidents.values()) {
			const startedTime = new Date(incident.startedAt).getTime();
			// Always include open active incidents
			if (incident.resolvedAt === null) {
				list.push({ ...incident });
				continue;
			}

			const resolvedTime = new Date(incident.resolvedAt).getTime();
			if (startedTime >= sinceTime || resolvedTime >= sinceTime) {
				list.push({ ...incident });
			}
		}

		// Reverse chronological order (most recent first)
		return list.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
	}

	/**
	 * Fetches recent incident history for a specific probe.
	 */
	async fetchProbeHistory(probeId: string): Promise<NormalizedIncident[]> {
		const past24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
		const incidents = await this.fetchIncidents(past24h);
		return incidents.filter((i) => i.probeId === probeId);
	}

	/**
	 * Recommended polling interval (5 seconds for dev).
	 */
	getPollingInterval(): number {
		return 5000;
	}

	// ============================================================================
	// PRIVATE GENERATION & SIMULATION METHODS
	// ============================================================================

	/**
	 * Generates initial probe state and some historical incidents.
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

			// Create active incident for probes starting DOWN
			if (status === 'down') {
				const incidentId = `inc:${id}:${now - 600000}`;
				this.incidents.set(incidentId, {
					id: incidentId,
					probeId: id,
					probeName: probe.name,
					type: 'down',
					startedAt: new Date(now - 10 * 60 * 1000).toISOString(), // 10 min ago
					resolvedAt: null,
					duration: null
				});
			}
		}

		// Inject realistic historical resolved incidents within last 24h
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
				duration: 320,
				cause: 'HTTP 503 - Service Unavailable'
			});
		}

		// Past incident on mock:3 (12 min outage resolved)
		const probeThree = this.probes.get('mock:3');
		if (probeThree) {
			const pastIncId3 = `inc:${probeThree.id}:${now - 18000000}`;
			this.incidents.set(pastIncId3, {
				id: pastIncId3,
				probeId: probeThree.id,
				probeName: probeThree.name,
				type: 'down',
				startedAt: new Date(now - 5 * 3600 * 1000).toISOString(),
				resolvedAt: new Date(now - (5 * 3600 - 720) * 1000).toISOString(),
				duration: 720,
				cause: 'Connection Pool Timeout (504)'
			});
		}

		// Degraded incident on mock:7 (25 min instability resolved)
		const probeSeven = this.probes.get('mock:7');
		if (probeSeven) {
			const pastIncId7 = `inc:${probeSeven.id}:${now - 32400000}`;
			this.incidents.set(pastIncId7, {
				id: pastIncId7,
				probeId: probeSeven.id,
				probeName: probeSeven.name,
				type: 'degraded',
				startedAt: new Date(now - 9 * 3600 * 1000).toISOString(),
				resolvedAt: new Date(now - (9 * 3600 - 1500) * 1000).toISOString(),
				duration: 1500,
				cause: 'Latency spike (>1800ms) - GC Pause'
			});
		}
	}

	/**
	 * Resolves probe metadata (name, group, URL, criticality).
	 */
	private resolveBlueprint(index: number): ServiceBlueprint {
		if (index <= BLUEPRINTS.length) {
			return BLUEPRINTS[index - 1];
		}

		// Procedural generation beyond static blueprints
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
	 * Determines initial status according to target distribution:
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
	 * Computes realistic response time based on status.
	 */
	private computeResponseTime(status: ProbeStatus): number | null {
		if (status === 'down' || status === 'paused' || status === 'pending') {
			return null;
		}

		if (status === 'degraded') {
			// Degraded: high latency between 350ms and 500ms
			return Math.floor(350 + Math.random() * 150);
		}

		// UP status: nominal latency between 50ms and 250ms
		return Math.floor(50 + Math.random() * 200);
	}

	/**
	 * Computes realistic uptime percentage between 95.00% and 100.00%.
	 */
	private computeUptime(status: ProbeStatus, seedOffset: number): number {
		const base = status === 'down' ? 96.2 : status === 'degraded' ? 97.8 : 99.4;
		const variance = ((seedOffset % 17) / 17) * 0.6;
		const finalValue = Math.min(100, Math.max(95, base + variance));
		return Math.round(finalValue * 100) / 100;
	}

	/**
	 * Simulates live cycle: ~5% chance of status transition per probe plus latency micro-variations.
	 */
	private simulateLiveCycle(): void {
		const now = Date.now();
		const nowIso = new Date(now).toISOString();

		for (const probe of this.probes.values()) {
			probe.lastCheck = nowIso;

			// 5% chance of status transition
			if (Math.random() < 0.05) {
				const oldStatus = probe.status;
				const newStatus = this.pickNextStatus(oldStatus);

				if (oldStatus !== newStatus) {
					probe.status = newStatus;
					probe.responseTime = this.computeResponseTime(newStatus);

					// Handle incident lifecycle for transitions
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
						// Close active incident
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
				// Micro-variations in latency for active probes
				if (probe.responseTime !== null) {
					const delta = (Math.random() - 0.5) * 30; // +/-15ms
					const updated = Math.round(probe.responseTime + delta);
					probe.responseTime = Math.min(500, Math.max(50, updated));
				}
			}
		}
	}

	/**
	 * Picks next status upon transition.
	 */
	private pickNextStatus(current: ProbeStatus): ProbeStatus {
		const roll = Math.random();

		switch (current) {
			case 'down':
				// High recovery probability
				return roll < 0.8 ? 'up' : 'degraded';
			case 'degraded':
				// Recover to UP, drop to DOWN, or remain degraded
				return roll < 0.7 ? 'up' : roll < 0.9 ? 'down' : 'degraded';
			case 'paused':
				return roll < 0.6 ? 'up' : 'paused';
			case 'pending':
				return roll < 0.8 ? 'up' : 'pending';
			case 'maintenance':
				return roll < 0.7 ? 'up' : 'maintenance';
			case 'up':
			default:
				// Occasional degradation or outage
				return roll < 0.5 ? 'degraded' : roll < 0.8 ? 'down' : 'paused';
		}
	}
}

export default MockAdapter;
