import type { DashboardDelta, DashboardState } from '$lib/types';

export type ConnectionStatus = 'connected' | 'disconnected' | 'reconnecting';

type OnInitCallback = (state: DashboardState) => void;
type OnUpdateCallback = (delta: DashboardDelta) => void;
type OnHeartbeatCallback = (data: { timestamp: string }) => void;
type OnStatusCallback = (status: ConnectionStatus) => void;

/**
 * Connects the client to the backend Server-Sent Events (SSE) stream.
 * Handles disconnection detection, automatic reconnection with fallback timer,
 * and notifies network status changes ("Connection lost" banner).
 *
 * @param onInit Function called on initial handshake with complete state snapshot
 * @param onUpdate Function called on state change with received delta
 * @param onHeartbeat Optional function called when a heartbeat frame is received
 * @param onStatusChange Optional function called when connection status transitions
 * @returns Disconnect function to close connection and cancel reconnection timers
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
					console.error('[SSE Client] Error parsing init event:', err);
				}
			});

			eventSource.addEventListener('update', (event: MessageEvent) => {
				try {
					const data = JSON.parse(event.data) as DashboardDelta;
					onStatusChange?.('connected');
					onUpdate(data);
				} catch (err) {
					console.error('[SSE Client] Error parsing update event:', err);
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
					console.error('[SSE Client] Error parsing heartbeat event:', err);
				}
			});

			eventSource.onerror = (error) => {
				console.warn('[SSE Client] Connection lost with SSE server:', error);
				onStatusChange?.('disconnected');

				// Force fallback reconnection when browser doesn't recover automatically
				scheduleReconnect();
			};
		} catch (err) {
			console.error('[SSE Client] Error instantiating EventSource:', err);
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
		console.log('[SSE Client] Connection closed by client.');
	};
}
