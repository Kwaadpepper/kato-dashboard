import type { MonitoringAdapter } from '$lib/types';
import type { DashboardStore } from './store';

/**
 * Fonction retournée par startPolling pour arrêter proprement le poller.
 */
export type StopPolling = () => void;

/**
 * Démarre le service de polling pour un adaptateur donné.
 *
 * Comportement :
 * - Premier appel immédiat dès l'invocation (pas d'attente du premier intervalle).
 * - Verrou d'exécution pour éviter les appels concurrents si l'adaptateur répond lentement.
 * - En cas d'erreur API : log de l'erreur + conservation de l'état précédent (pas de crash).
 * - Log à chaque cycle : nombre de sondes polled et nombre de changements.
 *
 * @param adapter L'adaptateur de monitoring à interroger.
 * @param store   Le store in-memory à mettre à jour.
 * @returns       Une fonction stop() pour interrompre le polling.
 */
export function startPolling(adapter: MonitoringAdapter, store: DashboardStore): StopPolling {
	const intervalMs = adapter.getPollingInterval();
	let isPolling = false;
	let timer: ReturnType<typeof setInterval> | null = null;
	let stopped = false;

	/**
	 * Exécute un cycle de polling : fetch des sondes + mise à jour du store.
	 */
	async function poll(): Promise<void> {
		// Verrou : on ignore le cycle si le précédent n'est pas terminé
		if (isPolling) {
			console.warn(`[Poller] Cycle ignoré (le précédent est encore en cours) — adapter: ${adapter.name}`);
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
			// Non-bloquant : on log et on continue
			console.error(`[Poller] Erreur lors du polling — adapter: ${adapter.name}`, err);
		} finally {
			isPolling = false;
		}
	}

	// Premier appel immédiat
	poll();

	// Démarrage de l'intervalle récurrent
	timer = setInterval(() => {
		if (!stopped) {
			poll();
		}
	}, intervalMs);

	console.log(`[Poller] Démarré — adapter: ${adapter.name}, intervalle: ${intervalMs}ms`);

	/**
	 * Arrête le polling proprement.
	 */
	function stop(): void {
		stopped = true;
		if (timer !== null) {
			clearInterval(timer);
			timer = null;
		}
		console.log(`[Poller] Arrêté — adapter: ${adapter.name}`);
	}

	return stop;
}
