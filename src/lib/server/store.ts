import type { DashboardDelta, DashboardState, NormalizedIncident, NormalizedProbe } from '$lib/types';
import { getDefaultClientSettings } from './config.ts';

/** Rolling window duration for keeping incidents in RAM (24h in ms) */
const INCIDENT_ROLLING_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Tolerance threshold for response time jitter (in ms).
 * Micro-fluctuations below this threshold do not trigger a delta event.
 */
const RESPONSE_TIME_JITTER_THRESHOLD_MS = 20;

type DeltaCallback = (delta: DashboardDelta) => void;

/**
 * In-memory singleton store maintaining current dashboard state.
 *
 * Responsibilities:
 * - Probe storage indexed by ID in a Map.
 * - Differential (delta) change detection on each update.
 * - Incident management with a 24-hour rolling window.
 * - Pub/sub system notifying SSE subscribers.
 */
class DashboardStore {
	/** Primary probe index (ID -> probe) */
	private probes: Map<string, NormalizedProbe> = new Map();

	/** Incident index for active + resolved within 24h */
	private incidents: Map<string, NormalizedIncident> = new Map();

	/** Active source provider names */
	private activeSources: Set<string> = new Set();

	/** Timestamp of last update */
	private lastUpdate = new Date().toISOString();

	/** SSE subscribers set */
	private subscribers: Set<DeltaCallback> = new Set();

	// ============================================================================
	// STATE READS
	// ============================================================================

	/**
	 * Retrieves an individual probe by ID.
	 */
	getProbe(id: string): NormalizedProbe | undefined {
		return this.probes.get(id);
	}

	/**
	 * Returns a complete snapshot of the dashboard's current state.
	 * Used for the `init` SSE event when a new client connects.
	 */
	getState(): DashboardState {
		return {
			probes: Array.from(this.probes.values()),
			incidents: this.getIncidents(),
			lastUpdate: this.lastUpdate,
			source: Array.from(this.activeSources).join(', ') || 'unknown',
			defaultSettings: getDefaultClientSettings()
		};
	}

	/**
	 * Returns incidents within the 24-hour rolling window,
	 * sorted in reverse chronological order (most recent first).
	 */
	getIncidents(): NormalizedIncident[] {
		return Array.from(this.incidents.values()).sort(
			(a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
		);
	}

	/**
	 * Loads initial incidents (e.g. from adapter during startup).
	 */
	loadInitialIncidents(incidents: NormalizedIncident[]): void {
		for (const inc of incidents) {
			if (!this.incidents.has(inc.id)) {
				this.incidents.set(inc.id, inc);
			}
		}
	}

	// ============================================================================
	// UPDATES & DELTA DETECTION
	// ============================================================================

	/**
	 * Updates the store with a new list of probes.
	 *
	 * - Compares each probe with memory version.
	 * - Generates a DashboardDelta if significant changes are detected.
	 * - Updates incidents list (open and close).
	 * - Purges incidents outside the 24h rolling window.
	 * - Notifies subscribers when a delta is produced.
	 *
	 * @returns The generated delta, or null if no changes occurred.
	 */
	updateProbes(probes: NormalizedProbe[], source?: string): DashboardDelta | null {
		if (source) {
			this.activeSources.add(source);
		}

		const now = Date.now();
		const nowIso = new Date(now).toISOString();
		const changed: NormalizedProbe[] = [];
		const newIncidents: NormalizedIncident[] = [];
		const resolvedIncidentIds: string[] = [];

		// ── 1. Change detection ──────────────────────────────────────────────────
		for (const incoming of probes) {
			const existing = this.probes.get(incoming.id);

			if (!existing) {
				// New probe — always considered a change
				if (incoming.status === 'down') {
					incoming.downSince = incoming.downSince || nowIso;
				}
				this.probes.set(incoming.id, { ...incoming });
				changed.push(incoming);

				// Open incident if starting DOWN or DEGRADED
				if (incoming.status === 'down' || incoming.status === 'degraded') {
					const incident = this.openIncident(incoming, nowIso);
					this.incidents.set(incident.id, incident);
					newIncidents.push(incident);
				}
				continue;
			}

			// Retain existing downSince if still down
			if (existing.status === 'down' && incoming.status === 'down') {
				incoming.downSince = existing.downSince;
			} else if (incoming.status === 'down' && existing.status !== 'down') {
				incoming.downSince = nowIso;
			} else if (incoming.status !== 'down') {
				delete incoming.downSince;
			}

			// Check for significant changes
			const statusChanged = existing.status !== incoming.status;
			const responseTimeChanged = hasResponseTimeChanged(
				existing.responseTime,
				incoming.responseTime
			);
			const uptimeChanged =
				existing.uptime24h !== incoming.uptime24h || existing.uptime7d !== incoming.uptime7d;

			if (statusChanged || responseTimeChanged || uptimeChanged) {
				changed.push(incoming);
				this.probes.set(incoming.id, { ...incoming });

				if (statusChanged) {
					// ── Transition to problematic state ──────────────────────────────
					if (
						(incoming.status === 'down' || incoming.status === 'degraded') &&
						existing.status !== 'down' &&
						existing.status !== 'degraded'
					) {
						const incident = this.openIncident(incoming, nowIso);
						this.incidents.set(incident.id, incident);
						newIncidents.push(incident);
					}

					// ── Recovery: transition back to healthy state ───────────────────
					if (
						incoming.status !== 'down' &&
						incoming.status !== 'degraded' &&
						(existing.status === 'down' || existing.status === 'degraded')
					) {
						const resolved = this.closeIncident(incoming.id, nowIso);
						resolvedIncidentIds.push(...resolved);
					}
				}
			} else {
				// No significant change — still update probe with latest check
				this.probes.set(incoming.id, { ...incoming });
			}
		}

		// ── 2. Purge rolling window (resolved incidents > 24h) ───────────────────
		this.purgeOldIncidents(now);

		// ── 3. Update timestamp ──────────────────────────────────────────────────
		this.lastUpdate = nowIso;

		// ── 4. No significant changes -> no delta ────────────────────────────────
		if (changed.length === 0 && newIncidents.length === 0 && resolvedIncidentIds.length === 0) {
			return null;
		}

		const delta: DashboardDelta = {
			changed,
			newIncidents,
			resolvedIncidentIds,
			timestamp: nowIso
		};

		// ── 5. Notify subscribers ────────────────────────────────────────────────
		this.notifySubscribers(delta);

		return delta;
	}

	// ============================================================================
	// PUB/SUB
	// ============================================================================

	/**
	 * Registers a subscriber to receive real-time deltas.
	 * Returns an unsubscribe callback to call on SSE client disconnect.
	 */
	subscribe(callback: DeltaCallback): () => void {
		this.subscribers.add(callback);
		return () => {
			this.subscribers.delete(callback);
		};
	}

	/**
	 * Returns the count of active subscribers (used for leak tests).
	 */
	getSubscriberCount(): number {
		return this.subscribers.size;
	}

	// ============================================================================
	// PRIVATE METHODS
	// ============================================================================

	/**
	 * Creates a new open incident for a degraded or down probe.
	 */
	private openIncident(probe: NormalizedProbe, nowIso: string): NormalizedIncident {
		const incidentId = `inc:${probe.id}:${Date.now()}`;
		return {
			id: incidentId,
			probeId: probe.id,
			probeName: probe.name,
			type: probe.status === 'down' ? 'down' : 'degraded',
			startedAt: nowIso,
			resolvedAt: null,
			duration: null
		};
	}

	/**
	 * Closes all active incidents for a probe and returns their IDs.
	 */
	private closeIncident(probeId: string, nowIso: string): string[] {
		const resolved: string[] = [];
		const now = new Date(nowIso).getTime();

		for (const incident of this.incidents.values()) {
			if (incident.probeId === probeId && incident.resolvedAt === null) {
				incident.resolvedAt = nowIso;
				incident.duration = Math.max(
					1,
					Math.round((now - new Date(incident.startedAt).getTime()) / 1000)
				);
				resolved.push(incident.id);
			}
		}

		return resolved;
	}

	/**
	 * Removes resolved incidents older than the 24-hour rolling window.
	 */
	private purgeOldIncidents(nowMs: number): void {
		const cutoff = nowMs - INCIDENT_ROLLING_WINDOW_MS;
		for (const [id, incident] of this.incidents) {
			if (incident.resolvedAt !== null) {
				const resolvedMs = new Date(incident.resolvedAt).getTime();
				if (resolvedMs < cutoff) {
					this.incidents.delete(id);
				}
			}
		}
	}

	/**
	 * Broadcasts a delta to all registered subscribers.
	 */
	private notifySubscribers(delta: DashboardDelta): void {
		for (const cb of this.subscribers) {
			try {
				cb(delta);
			} catch (err) {
				console.error('[Store] Error in SSE subscriber callback:', err);
			}
		}
	}

	/**
	 * Clears the store state (useful in test suites).
	 */
	reset(): void {
		this.probes.clear();
		this.incidents.clear();
		this.activeSources.clear();
		this.subscribers.clear();
		this.lastUpdate = new Date().toISOString();
	}
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Determines whether response time jitter exceeds threshold.
 */
function hasResponseTimeChanged(a: number | null, b: number | null): boolean {
	if (a === null && b === null) return false;
	if (a === null || b === null) return true;
	return Math.abs(a - b) > RESPONSE_TIME_JITTER_THRESHOLD_MS;
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

/**
 * Singleton store instance shared between poller and SSE endpoint.
 * Exported at module level for hooks.server.ts and API routes.
 */
export const store = new DashboardStore();
export type { DashboardStore };
