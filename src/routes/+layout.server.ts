import { getDefaultClientSettings } from '$lib/server/config';
import type { LayoutServerLoad } from './$types';

/**
 * Charge les réglages par défaut du BFF issus des variables d'environnement.
 * Rendu accessible à l'ensemble des pages de l'application (+layout.svelte, +page.svelte, /login).
 */
export const load: LayoutServerLoad = () => {
	return {
		defaultSettings: getDefaultClientSettings()
	};
};
