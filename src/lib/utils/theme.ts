import type { Theme } from '$lib/types';

export type { Theme };
export type ResolvedTheme = 'dark' | 'light' | 'amoled';

/** LocalStorage persistence key */
export const THEME_STORAGE_KEY = 'kato-theme';

/** Exhaustive list of valid theme values */
const VALID_THEMES: readonly Theme[] = ['dark', 'light', 'amoled', 'auto'] as const;

type ThemeListener = (theme: Theme, resolved: ResolvedTheme) => void;
const listeners = new Set<ThemeListener>();

let currentTheme: Theme = 'dark';
let currentResolved: ResolvedTheme = 'dark';
let mediaQueryList: MediaQueryList | null = null;
let mediaQueryHandler: ((e: MediaQueryListEvent) => void) | null = null;

/**
 * Resolves effective visual theme ('dark', 'light', or 'amoled').
 * When theme is 'auto', queries the browser's prefers-color-scheme media query.
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
 * Retrieves the initially configured theme:
 * 1. Read from localStorage('kato-theme')
 * 2. If not found, use bffDefault if valid
 * 3. Fallback to 'dark'
 */
export function getInitialTheme(bffDefault?: Theme): Theme {
	if (typeof window !== 'undefined') {
		try {
			const saved = localStorage.getItem(THEME_STORAGE_KEY) as Theme | null;
			if (saved && VALID_THEMES.includes(saved)) {
				return saved;
			}
		} catch (err) {
			console.warn('[Theme] Error reading localStorage:', err);
		}
	}
	if (bffDefault && VALID_THEMES.includes(bffDefault)) {
		return bffDefault;
	}
	return 'dark';
}

/**
 * Returns currently configured theme preference (including 'auto').
 */
export function getCurrentTheme(): Theme {
	return currentTheme;
}

/**
 * Returns currently active resolved theme ('dark', 'light', or 'amoled').
 */
export function getResolvedTheme(): ResolvedTheme {
	return currentResolved;
}

/**
 * Applies the selected visual theme:
 * - Resolves effective theme
 * - Updates data-theme attribute on <html>
 * - Persists preference to localStorage('kato-theme')
 * - Attaches or detaches prefers-color-scheme listener when 'auto'
 * - Notifies all subscribers
 */
export function applyTheme(theme: Theme): void {
	currentTheme = theme;
	const resolved = resolveTheme(theme);
	currentResolved = resolved;

	if (typeof window !== 'undefined') {
		try {
			localStorage.setItem(THEME_STORAGE_KEY, theme);
		} catch (err) {
			console.warn('[Theme] Error writing to localStorage:', err);
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
			console.error('[Theme] Error in theme listener:', e);
		}
	}
}

/**
 * Configures or removes matchMedia event listener when 'auto' mode is active.
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
 * Subscribes to theme changes.
 * Returns an unsubscribe callback.
 */
export function onThemeChange(listener: ThemeListener): () => void {
	listeners.add(listener);
	listener(currentTheme, currentResolved);
	return () => {
		listeners.delete(listener);
	};
}
