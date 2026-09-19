import { MockAdapter } from '$lib/server/adapters/mock.adapter';
import { store } from '$lib/server/store';
import { startPolling } from '$lib/server/poller';
import type { Handle } from '@sveltejs/kit';

// ============================================================================
// INITIALISATION AU DÉMARRAGE DU SERVEUR
// ============================================================================

/**
 * Lit la variable d'environnement KATO_ADAPTER pour sélectionner l'adaptateur.
 * Défaut : "mock".
 */
const adapterType = process.env.KATO_ADAPTER ?? 'mock';

/**
 * Instancie et initialise l'adaptateur de monitoring au démarrage du module.
 * Le hook handle n'est pas le bon endroit pour un init async global : on
 * utilise un IIFE async qui s'exécute une seule fois au chargement du module.
 */
async function bootstrap(): Promise<void> {
	let adapter;

	// Sélection de l'adaptateur selon la configuration
	switch (adapterType) {
		case 'mock':
		default:
			adapter = new MockAdapter();
			console.log(`[Kato] Adaptateur sélectionné : mock`);
			break;
	}

	// Lecture des paramètres de configuration depuis l'environnement
	const count = parseInt(process.env.KATO_MOCK_COUNT ?? '50', 10);

	// Initialisation de l'adaptateur
	await adapter.initialize({ count });
	console.log(`[Kato] Adaptateur initialisé — type: ${adapterType}`);

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
