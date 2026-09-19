import type { DashboardState, DashboardDelta } from '$lib/types';

type OnInitCallback = (state: DashboardState) => void;
type OnUpdateCallback = (delta: DashboardDelta) => void;
type OnHeartbeatCallback = (data: { timestamp: string }) => void;

/**
 * Connecte le client au flux Server-Sent Events (SSE) du backend.
 * Utilise l'API native EventSource qui gère automatiquement les reconnexions.
 *
 * @param onInit Fonction appelée à la connexion initiale avec l'état complet
 * @param onUpdate Fonction appelée lors d'un changement d'état avec le delta
 * @param onHeartbeat (Optionnel) Fonction appelée lors de la réception d'un heartbeat
 * @returns Une fonction pour fermer manuellement la connexion
 */
export function connectSSE(
	onInit: OnInitCallback,
	onUpdate: OnUpdateCallback,
	onHeartbeat?: OnHeartbeatCallback
): () => void {
	const eventSource = new EventSource('/api/events');

	eventSource.addEventListener('init', (event: MessageEvent) => {
		try {
			const data = JSON.parse(event.data) as DashboardState;
			onInit(data);
		} catch (err) {
			console.error('[SSE Client] Erreur lors du parsing de l\'événement init:', err);
		}
	});

	eventSource.addEventListener('update', (event: MessageEvent) => {
		try {
			const data = JSON.parse(event.data) as DashboardDelta;
			onUpdate(data);
		} catch (err) {
			console.error('[SSE Client] Erreur lors du parsing de l\'événement update:', err);
		}
	});

	eventSource.addEventListener('heartbeat', (event: MessageEvent) => {
		try {
			const data = JSON.parse(event.data) as { timestamp: string };
			if (onHeartbeat) {
				onHeartbeat(data);
			}
		} catch (err) {
			console.error('[SSE Client] Erreur lors du parsing de l\'événement heartbeat:', err);
		}
	});

	eventSource.onerror = (error) => {
		console.error('[SSE Client] Erreur de connexion EventSource, tentative de reconnexion...', error);
		// Note : L'EventSource natif se reconnecte automatiquement.
		// On pourrait ajouter une logique de backoff ou un état "offline" ici.
	};

	// Retourne la fonction permettant de se désabonner proprement
	return function disconnect() {
		eventSource.close();
		console.log('[SSE Client] Connexion fermée par le client.');
	};
}
