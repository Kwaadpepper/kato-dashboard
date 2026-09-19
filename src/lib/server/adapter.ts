import type { MonitoringAdapter } from '$lib/types';

let activeAdapter: MonitoringAdapter | null = null;

/**
 * Enregistre l'adaptateur de monitoring actif pour l'instance du serveur.
 */
export function setActiveAdapter(adapter: MonitoringAdapter): void {
	activeAdapter = adapter;
}

/**
 * Récupère l'adaptateur de monitoring actif courant.
 */
export function getActiveAdapter(): MonitoringAdapter | null {
	return activeAdapter;
}
