import { getDefaultClientSettings } from '$lib/server/config';
import type { LayoutServerLoad } from './$types';

/**
 * Loads default client settings resolved by the BFF from environment variables.
 * Made available to all application pages (+layout.svelte, +page.svelte, /login).
 */
export const load: LayoutServerLoad = () => {
	return {
		defaultSettings: getDefaultClientSettings()
	};
};
