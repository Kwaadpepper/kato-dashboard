import { MockAdapter } from '$lib/server/adapters/mock.adapter';
import { UptimeRobotAdapter } from '$lib/server/adapters/uptime-robot.adapter';
import { store } from '$lib/server/store';
import { startPolling } from '$lib/server/poller';
import type { MonitoringAdapter } from '$lib/types';
import type { Handle } from '@sveltejs/kit';

// ============================================================================
// INITIALISATION AU DÉMARRAGE DU SERVEUR
// ============================================================================

/**
 * Lit la variable d'environnement KATO_ADAPTER (ou ADAPTER_TYPE) pour sélectionner l'adaptateur.
 * Valeurs supportées : "uptimerobot", "mock" (défaut).
 */
const adapterType = (process.env.KATO_ADAPTER || process.env.ADAPTER_TYPE || 'mock').toLowerCase();

/**
 * Instancie et initialise l'adaptateur de monitoring au démarrage du module.
 * Le hook handle n'est pas le bon endroit pour un init async global : on
 * utilise un IIFE async qui s'exécute une seule fois au chargement du module.
 */
async function bootstrap(): Promise<void> {
	let adapter: MonitoringAdapter;

	// Sélection et instanciation de l'adaptateur selon la configuration
	if (adapterType === 'uptimerobot') {
		adapter = new UptimeRobotAdapter();
		console.log(`[Kato] Adaptateur sélectionné : uptimerobot`);

		const apiKey = process.env.UPTIMEROBOT_API_KEY ?? '';
		const pollInterval = process.env.UPTIMEROBOT_POLL_INTERVAL
			? parseInt(process.env.UPTIMEROBOT_POLL_INTERVAL, 10)
			: 30000;

		await adapter.initialize({ apiKey, pollInterval });
	} else {
		adapter = new MockAdapter();
		console.log(`[Kato] Adaptateur sélectionné : mock`);

		const count = parseInt(process.env.KATO_MOCK_COUNT ?? '50', 10);
		await adapter.initialize({ count });
	}

	console.log(`[Kato] Adaptateur initialisé — type: ${adapter.name}`);

	// Démarrage du polling (produit les mises à jour dans le store)
	startPolling(adapter, store);
}

// Lancement immédiat au chargement du module serveur
bootstrap().catch((err) => {
	console.error('[Kato] Erreur critique au démarrage :', err);
});

// ============================================================================
// HOOK SVELTEKIT
// ============================================================================

/**
 * Hook serveur SvelteKit.
 * Passe-through par défaut : l'initialisation est gérée par le bootstrap ci-dessus.
 * On peut ici ajouter une authentification ou des middlewares globaux ultérieurement.
 */
export const handle: Handle = async ({ event, resolve }) => {
	return resolve(event);
};
