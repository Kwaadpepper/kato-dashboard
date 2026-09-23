import { env } from '$env/dynamic/private';
import { registerAdapter, setActiveAdapter } from '$lib/server/adapter';
import { createAndInitAdapter } from '$lib/server/adapters/factory';
import { isAuthEnabled, isValidSession, SESSION_COOKIE_NAME } from '$lib/server/auth';
import { loadAdaptersConfig } from '$lib/server/config';
import { startMultiPolling } from '$lib/server/poller';
import { store } from '$lib/server/store';
import type { MonitoringAdapter } from '$lib/types';
import { redirect, type Handle } from '@sveltejs/kit';

// ============================================================================
// SERVER STARTUP INITIALIZATION
// ============================================================================

/**
 * Instantiates, initializes and starts background polling for all configured adapters.
 */
async function bootstrap(): Promise<void> {
	const adapterConfigs = loadAdaptersConfig(env as unknown as Record<string, string | undefined>);
	console.log(`[Kato] Loading ${adapterConfigs.length} configured adapter instance(s)...`);

	const initializedAdapters: MonitoringAdapter[] = [];

	for (const config of adapterConfigs) {
		try {
			const adapter = await createAndInitAdapter(config);
			registerAdapter(adapter);
			initializedAdapters.push(adapter);
			console.log(`[Kato] Adapter initialized: "${adapter.name}" (type: ${config.type})`);
		} catch (err) {
			console.error(`[Kato] Failed to initialize adapter "${config.id}" (${config.type}):`, err);
		}
	}

	if (initializedAdapters.length === 0) {
		console.warn('[Kato] No adapters could be initialized. Falling back to default mock adapter.');
		const fallback = await createAndInitAdapter({ id: 'mock', type: 'mock', count: 50 });
		registerAdapter(fallback);
		initializedAdapters.push(fallback);
	}

	// Set primary adapter for legacy endpoints
	setActiveAdapter(initializedAdapters[0]);

	// Start independent background pollers
	startMultiPolling(initializedAdapters, store);
	console.log(`[Kato] Multi-polling active for ${initializedAdapters.length} adapter(s).`);
}

// Await at module level so every request is served after adapters are ready
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
