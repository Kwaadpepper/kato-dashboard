import type { MonitoringAdapter } from '$lib/types';
import type { DashboardStore } from './store';

/**
 * Cleanup function returned by startPolling to stop polling gracefully.
 */
export type StopPolling = () => void;

/**
 * Starts the polling service for a given monitoring adapter.
 *
 * Behavior:
 * - Executes immediately upon invocation (no waiting for the first tick).
 * - Concurrency lock prevents overlapping runs if the adapter takes longer than the interval.
 * - Non-fatal error handling: logs errors and preserves last known state (no crash).
 * - Logs per-cycle stats: probed count and change count.
 *
 * @param adapter Monitoring adapter to poll.
 * @param store   In-memory store to update.
 * @returns       A stop() function to terminate polling.
 */
export function startPolling(adapter: MonitoringAdapter, store: DashboardStore): StopPolling {
	const intervalMs = adapter.getPollingInterval();
	let isPolling = false;
	let timer: ReturnType<typeof setInterval> | null = null;
	let stopped = false;

	/**
	 * Executes a polling cycle: fetches probes and updates store.
	 */
	async function poll(): Promise<void> {
		// Concurrency lock: skip if previous tick is still ongoing
		if (isPolling) {
			console.warn(`[Poller] Cycle skipped (previous run still active) — adapter: ${adapter.name}`);
			return;
		}

		isPolling = true;
		try {
			const probes = await adapter.fetchProbes();
			const delta = store.updateProbes(probes, adapter.name);
			const changes = delta
				? delta.changed.length + delta.newIncidents.length + delta.resolvedIncidentIds.length
				: 0;

			console.log(
				`[Poller] Polled ${probes.length} probes, ${changes} changes — adapter: ${adapter.name}`
			);
		} catch (err) {
			// Non-blocking: log error and preserve state
			console.error(`[Poller] Error during polling — adapter: ${adapter.name}`, err);
		} finally {
			isPolling = false;
		}
	}

	// Fetch initial incidents from adapter (24h window)
	adapter
		.fetchIncidents(new Date(Date.now() - 24 * 60 * 60 * 1000))
		.then((initialIncidents) => {
			if (initialIncidents && initialIncidents.length > 0) {
				store.loadInitialIncidents(initialIncidents);
				console.log(
					`[Poller] Loaded ${initialIncidents.length} initial incident(s) — adapter: ${adapter.name}`
				);
			}
		})
		.catch((err) => {
			console.warn('[Poller] Warning while loading initial incidents:', err);
		});

	// Immediate initial execution
	poll();

	// Start recurring interval
	timer = setInterval(() => {
		if (!stopped) {
			poll();
		}
	}, intervalMs);

	console.log(`[Poller] Started — adapter: ${adapter.name}, interval: ${intervalMs}ms`);

	/**
	 * Stops polling gracefully.
	 */
	function stop(): void {
		stopped = true;
		if (timer !== null) {
			clearInterval(timer);
			timer = null;
		}
		console.log(`[Poller] Stopped — adapter: ${adapter.name}`);
	}

	return stop;
}
