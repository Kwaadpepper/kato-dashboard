import type { DashboardDelta, DashboardState } from '$lib/types';

export type ConnectionStatus = 'connected' | 'disconnected' | 'reconnecting';

type OnInitCallback = (state: DashboardState) => void;
type OnUpdateCallback = (delta: DashboardDelta) => void;
type OnHeartbeatCallback = (data: { timestamp: string }) => void;
type OnStatusCallback = (status: ConnectionStatus) => void;

/**
 * Connecte le client au flux Server-Sent Events (SSE) du backend.
 * Gère la détection de coupure, la reconnexion automatique avec repli
 * et la notification d'état de connexion pour l'affichage utilisateur ("Connexion perdue").
 *
 * @param onInit Fonction appelée à la connexion initiale avec l'état complet
 * @param onUpdate Fonction appelée lors d'un changement d'état avec le delta
 * @param onHeartbeat (Optionnel) Fonction appelée lors de la réception d'un heartbeat
 * @param onStatusChange (Optionnel) Fonction appelée lors d'un changement d'état réseau
 * @returns Une fonction pour fermer manuellement la connexion et annuler les reconnexions
 */
export function connectSSE(
	onInit: OnInitCallback,
	onUpdate: OnUpdateCallback,
	onHeartbeat?: OnHeartbeatCallback,
	onStatusChange?: OnStatusCallback
): () => void {
	let eventSource: EventSource | null = null;
	let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
	let isClosedByUser = false;

	function setupEventSource() {
		if (isClosedByUser) return;

		try {
			eventSource = new EventSource('/api/events');

			eventSource.onopen = () => {
				onStatusChange?.('connected');
			};

			eventSource.addEventListener('init', (event: MessageEvent) => {
				try {
					const data = JSON.parse(event.data) as DashboardState;
					onStatusChange?.('connected');
					onInit(data);
				} catch (err) {
					console.error('[SSE Client] Erreur lors du parsing de l\'événement init:', err);
				}
			});

			eventSource.addEventListener('update', (event: MessageEvent) => {
				try {
					const data = JSON.parse(event.data) as DashboardDelta;
					onStatusChange?.('connected');
					onUpdate(data);
				} catch (err) {
					console.error('[SSE Client] Erreur lors du parsing de l\'événement update:', err);
				}
			});

			eventSource.addEventListener('heartbeat', (event: MessageEvent) => {
				try {
					const data = JSON.parse(event.data) as { timestamp: string };
					onStatusChange?.('connected');
					if (onHeartbeat) {
						onHeartbeat(data);
					}
				} catch (err) {
					console.error('[SSE Client] Erreur lors du parsing de l\'événement heartbeat:', err);
				}
			});

			eventSource.onerror = (error) => {
				console.warn('[SSE Client] Connexion perdue avec le serveur SSE:', error);
				onStatusChange?.('disconnected');

				// Force une reconnexion de repli quand le navigateur ne se reconnecte pas seul.
				scheduleReconnect();
			};
		} catch (err) {
			console.error('[SSE Client] Erreur lors de l\'instanciation EventSource:', err);
			onStatusChange?.('disconnected');
			scheduleReconnect();
		}
	}

	function scheduleReconnect() {
		if (isClosedByUser || reconnectTimer) return;
		onStatusChange?.('reconnecting');

		if (eventSource) {
			eventSource.close();
			eventSource = null;
		}

		reconnectTimer = setTimeout(() => {
			reconnectTimer = null;
			setupEventSource();
		}, 3000);
	}

	setupEventSource();

	// Retourne la fonction permettant de se désabonner proprement
	return function disconnect() {
		isClosedByUser = true;
		if (reconnectTimer) {
			clearTimeout(reconnectTimer);
			reconnectTimer = null;
		}
		if (eventSource) {
			eventSource.close();
			eventSource = null;
		}
		console.log('[SSE Client] Connexion fermée par le client.');
	};
}
