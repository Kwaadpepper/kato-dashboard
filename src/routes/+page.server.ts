import { store } from '$lib/server/store';
import type { PageServerLoad } from './$types';

/**
 * SSR load function for the dashboard.
 * Retrieves initial snapshot from in-memory store at server-render time
 * to hydrate the client UI immediately before SSE connection is established.
 */
export const load: PageServerLoad = () => {
	return {
		initialState: store.getState()
	};
};
