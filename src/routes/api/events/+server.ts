import { isAuthEnabled, isValidSession, SESSION_COOKIE_NAME } from '$lib/server/auth';
import { store } from '$lib/server/store';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ cookies, request }) => {
	// Verify session if authentication is enabled
	if (isAuthEnabled()) {
		const token = cookies.get(SESSION_COOKIE_NAME);
		if (!isValidSession(token)) {
			return new Response(JSON.stringify({ error: 'Unauthorized' }), {
				status: 401,
				headers: { 'Content-Type': 'application/json' }
			});
		}
	}
	let unsubscribe: (() => void) | null = null;
	let heartbeatInterval: ReturnType<typeof setInterval> | null = null;
	let streamController: ReadableStreamDefaultController<Uint8Array> | null = null;
	let isCleanedUp = false;

	const cleanup = () => {
		if (isCleanedUp) return;
		isCleanedUp = true;

		try {
			request.signal.removeEventListener('abort', cleanup);
		} catch {
			// Ignore if already removed
		}

		if (unsubscribe) {
			try {
				unsubscribe();
			} catch (err) {
				console.error('[SSE] Error during unsubscription:', err);
			}
			unsubscribe = null;
		}

		if (heartbeatInterval) {
			clearInterval(heartbeatInterval);
			heartbeatInterval = null;
		}

		if (streamController) {
			try {
				streamController.close();
			} catch {
				// Controller already closed or cancelled
			}
			streamController = null;
		}

		console.log('[SSE] Client disconnected, cleanup completed.');
	};

	// Listen for client abort (e.g. closed tab or dropped TCP connection)
	if (request.signal.aborted) {
		cleanup();
	} else {
		request.signal.addEventListener('abort', cleanup, { once: true });
	}

	const stream = new ReadableStream<Uint8Array>({
		start(controller) {
			streamController = controller;

			if (isCleanedUp || request.signal.aborted) {
				cleanup();
				return;
			}

			const encoder = new TextEncoder();

			const sendEvent = (event: string, data: unknown) => {
				if (isCleanedUp) return;
				try {
					const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
					controller.enqueue(encoder.encode(payload));
				} catch (err) {
					console.error('[SSE] Error sending data, closing connection:', err);
					cleanup();
				}
			};

			// 1. Immediate initial snapshot delivery (DashboardState)
			sendEvent('init', store.getState());

			// 2. Subscribe to store for delta updates
			unsubscribe = store.subscribe((delta) => {
				sendEvent('update', delta);
			});

			// 3. Periodic heartbeat to keep TCP connection alive (avoids gateway timeouts)
			heartbeatInterval = setInterval(() => {
				sendEvent('heartbeat', { timestamp: new Date().toISOString() });
			}, 15_000);
		},
		cancel() {
			// Mandatory cleanup on client disconnect to prevent memory leaks
			cleanup();
		}
	});

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			'Connection': 'keep-alive',
			// Prevent proxy buffering (e.g. Nginx, Traefik)
			'X-Accel-Buffering': 'no'
		}
	});
};
