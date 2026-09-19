import { store } from '$lib/server/store';
import type { PageServerLoad } from './$types';

/**
 * Fonction de chargement SSR du dashboard.
 * Récupère l'état instantané du store in-memory au moment du rendu serveur
 * pour hydrater immédiatement l'interface client avant la connexion SSE.
 */
export const load: PageServerLoad = () => {
	return {
		initialState: store.getState()
	};
};
