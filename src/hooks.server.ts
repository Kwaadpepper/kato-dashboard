import { env } from '$env/dynamic/private';
import { MockAdapter } from '$lib/server/adapters/mock.adapter';
import { UptimeRobotAdapter } from '$lib/server/adapters/uptime-robot.adapter';
import { store } from '$lib/server/store';
import { startPolling } from '$lib/server/poller';
import { isAuthEnabled, isValidSession, SESSION_COOKIE_NAME } from '$lib/server/auth';
import { setActiveAdapter } from '$lib/server/adapter';
import { redirect, type Handle } from '@sveltejs/kit';
import type { MonitoringAdapter } from '$lib/types';

// ============================================================================
// SERVER STARTUP INITIALIZATION
// ============================================================================

/**
 * Reads environment variable KATO_ADAPTER (or ADAPTER_TYPE) to select the adapter.
 * Supported values: "uptimerobot", "mock" (default).
 */
const adapterType = (env.KATO_ADAPTER || env.ADAPTER_TYPE || 'mock').toLowerCase();

/**
 * Instantiates and initializes the monitoring adapter at startup.
 * The handle hook is not meant for one-time global async init;
 * an async IIFE runs once when the server module loads.
 */
async function bootstrap(): Promise<void> {
	let adapter: MonitoringAdapter;

	// Select and instantiate adapter based on configuration
	if (adapterType === 'uptimerobot') {
		adapter = new UptimeRobotAdapter();
		console.log(`[Kato] Selected adapter: uptimerobot`);

		const apiKey = env.UPTIMEROBOT_API_KEY ?? '';
		const pollInterval = env.UPTIMEROBOT_POLL_INTERVAL
			? Number.parseInt(env.UPTIMEROBOT_POLL_INTERVAL, 10)
			: 30000;

		await adapter.initialize({ apiKey, pollInterval });
	} else {
		adapter = new MockAdapter();
		console.log(`[Kato] Selected adapter: mock`);

		const count = Number.parseInt(env.KATO_MOCK_COUNT ?? '50', 10);
		await adapter.initialize({ count });
	}

	console.log(`[Kato] Adapter initialized — type: ${adapter.name}`);

	// Register adapter for individual lookup endpoints
	setActiveAdapter(adapter);

	// Start background polling (publishes updates to the store)
	startPolling(adapter, store);
}

// Await at module level so every request is served after the adapter is ready
await bootstrap();

// ============================================================================
// SVELTEKIT HOOK
// ============================================================================

/**
 * SvelteKit server handle hook.
 * Manages access control when KATO_AUTH_ENABLED is active.
 */
export const handle: Handle = async ({ event, resolve }) => {
	if (!isAuthEnabled()) return resolve(event);

	const { pathname } = event.url;
	if (pathname.startsWith('/_app/') || pathname === '/favicon.svg') return resolve(event);

	const sessionToken = event.cookies.get(SESSION_COOKIE_NAME);
	const authenticated = isValidSession(sessionToken);

	if (pathname === '/login') {
		if (authenticated) throw redirect(303, '/');
		return resolve(event);
	}

	if (!authenticated) {
		if (pathname.startsWith('/api/')) {
			return new Response(JSON.stringify({ error: 'Unauthorized' }), {
				status: 401,
				headers: { 'Content-Type': 'application/json' }
			});
		}
		throw redirect(303, '/login');
	}

	return resolve(event);
};
