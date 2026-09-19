import { isAuthEnabled, isValidSession, SESSION_COOKIE_NAME } from '$lib/server/auth';
import { store } from '$lib/server/store';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ cookies, request }) => {
	// Vérification de la session si l'authentification est activée
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
			// Ignorer si déjà retiré
		}

		if (unsubscribe) {
			try {
				unsubscribe();
			} catch (err) {
				console.error('[SSE] Erreur lors du désabonnement:', err);
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
				// Controller déjà fermé ou annulé
			}
			streamController = null;
		}

		console.log('[SSE] Client déconnecté, nettoyage effectué.');
	};

	// Écoute de l'interruption réseau du client (ex: fermeture d'onglet ou coupure TCP)
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
					console.error('[SSE] Erreur lors de l\'envoi des données, fermeture de la connexion:', err);
					cleanup();
				}
			};

			// 1. Envoi immédiat du snapshot initial (DashboardState)
			sendEvent('init', store.getState());

			// 2. Abonnement au store pour recevoir les deltas
			unsubscribe = store.subscribe((delta) => {
				sendEvent('update', delta);
			});

			// 3. Heartbeat périodique pour garder la connexion TCP vivante (évite les timeouts)
			heartbeatInterval = setInterval(() => {
				sendEvent('heartbeat', { timestamp: new Date().toISOString() });
			}, 15_000);
		},
		cancel() {
			// Nettoyage impératif lors de la déconnexion du client pour éviter les memory leaks
			cleanup();
		}
	});

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			'Connection': 'keep-alive',
			// Prévient la mise en cache par les reverse proxies (ex: Nginx, Traefik)
			'X-Accel-Buffering': 'no'
		}
	});
};
