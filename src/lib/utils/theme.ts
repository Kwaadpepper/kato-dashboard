import type { Theme } from '$lib/types';

export type { Theme };
export type ResolvedTheme = 'dark' | 'light' | 'amoled';

/** Clé de persistance dans le LocalStorage du navigateur */
export const THEME_STORAGE_KEY = 'kato-theme';

/** Liste exhaustive des valeurs de thème valides */
const VALID_THEMES: readonly Theme[] = ['dark', 'light', 'amoled', 'auto'] as const;

type ThemeListener = (theme: Theme, resolved: ResolvedTheme) => void;
const listeners = new Set<ThemeListener>();

let currentTheme: Theme = 'dark';
let currentResolved: ResolvedTheme = 'dark';
let mediaQueryList: MediaQueryList | null = null;
let mediaQueryHandler: ((e: MediaQueryListEvent) => void) | null = null;

/**
 * Résout le thème effectif (dark, light ou amoled).
 * Si le thème est 'auto', utilise prefers-color-scheme du navigateur.
 */
export function resolveTheme(theme: Theme): ResolvedTheme {
	if (theme === 'auto') {
		if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
			return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
		}
		return 'dark';
	}
	return theme;
}

/**
 * Récupère le thème initialement configuré :
 * 1. Lit depuis localStorage('kato-theme')
 * 2. Si non trouvé ou invalide, retourne le thème par défaut 'dark'
 */
export function getInitialTheme(): Theme {
	if (typeof window === 'undefined') return 'dark';
	try {
		const saved = localStorage.getItem(THEME_STORAGE_KEY) as Theme | null;
		if (saved && VALID_THEMES.includes(saved)) {
			return saved;
		}
	} catch (err) {
		console.warn('[Theme] Erreur lors de la lecture de localStorage:', err);
	}
	return 'dark';
}

/**
 * Retourne le thème actuellement configuré (y compris 'auto').
 */
export function getCurrentTheme(): Theme {
	return currentTheme;
}

/**
 * Retourne le thème effectif actuellement appliqué ('dark', 'light' ou 'amoled').
 */
export function getResolvedTheme(): ResolvedTheme {
	return currentResolved;
}

/**
 * Applique le thème sélectionné :
 * - Calcule la valeur résolue
 * - Met à jour l'attribut data-theme sur l'élément <html>
 * - Sauvegarde le choix dans localStorage('kato-theme')
 * - Active/désactive l'écouteur prefers-color-scheme si mode 'auto'
 * - Notifie tous les abonnés
 */
export function applyTheme(theme: Theme): void {
	currentTheme = theme;
	const resolved = resolveTheme(theme);
	currentResolved = resolved;

	if (typeof window !== 'undefined') {
		try {
			localStorage.setItem(THEME_STORAGE_KEY, theme);
		} catch (err) {
			console.warn('[Theme] Erreur lors de la sauvegarde dans localStorage:', err);
		}

		if (typeof document !== 'undefined') {
			document.documentElement.setAttribute('data-theme', resolved);
			document.documentElement.setAttribute('data-theme-mode', theme);
			document.documentElement.style.colorScheme = resolved === 'light' ? 'light' : 'dark';
		}

		setupAutoListener(theme === 'auto');
	}

	for (const listener of listeners) {
		try {
			listener(theme, resolved);
		} catch (e) {
			console.error('[Theme] Erreur dans le listener de thème:', e);
		}
	}
}

/**
 * Configure ou retire l'écouteur d'événements matchMedia quand le mode 'auto' est actif.
 */
function setupAutoListener(isAuto: boolean): void {
	if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;

	if (!mediaQueryList) {
		mediaQueryList = window.matchMedia('(prefers-color-scheme: dark)');
	}

	if (isAuto) {
		if (!mediaQueryHandler) {
			mediaQueryHandler = () => {
				if (currentTheme === 'auto') {
					applyTheme('auto');
				}
			};
			if (mediaQueryList.addEventListener) {
				mediaQueryList.addEventListener('change', mediaQueryHandler);
			} else {
				// Fallback pour anciens navigateurs
				mediaQueryList.addListener?.(mediaQueryHandler);
			}
		}
	} else {
		if (mediaQueryHandler && mediaQueryList) {
			if (mediaQueryList.removeEventListener) {
				mediaQueryList.removeEventListener('change', mediaQueryHandler);
			} else {
				mediaQueryList.removeListener?.(mediaQueryHandler);
			}
			mediaQueryHandler = null;
		}
	}
}

/**
 * Permet à un composant de s'abonner aux changements de thème.
 * Retourne une fonction de désabonnement.
 */
export function onThemeChange(listener: ThemeListener): () => void {
	listeners.add(listener);
	listener(currentTheme, currentResolved);
	return () => {
		listeners.delete(listener);
	};
}
