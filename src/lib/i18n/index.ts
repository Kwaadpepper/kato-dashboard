import { en } from './locales/en.ts';
import { fr } from './locales/fr.ts';
import type { SupportedLocale, TranslationKey, TranslationSchema } from './types.ts';
export type { SupportedLocale, TranslationKey, TranslationSchema };

export const KATO_LOCALE_STORAGE_KEY = 'kato-locale';

const dictionaries: Record<SupportedLocale, TranslationSchema> = {
	en,
	fr
};

export const LOCALE_OPTIONS: Array<{ id: SupportedLocale; label: string; flag: string }> = [
	{ id: 'en', label: 'English', flag: '🇬🇧' },
	{ id: 'fr', label: 'Français', flag: '🇫🇷' }
];

type LocaleListener = (locale: SupportedLocale) => void;
const listeners = new Set<LocaleListener>();

let currentLocale: SupportedLocale = 'en';

/**
 * Determines the initial locale following priority hierarchy:
 * 1. Explicit choice in `localStorage`
 * 2. Default setting sent from BFF
 * 3. Browser language (`navigator.language`)
 * 4. Fallback 'en'
 */
export function getInitialLocale(bffDefault?: SupportedLocale): SupportedLocale {
	if (typeof window !== 'undefined') {
		try {
			const saved = localStorage.getItem(KATO_LOCALE_STORAGE_KEY);
			if (saved === 'fr' || saved === 'en') {
				return saved;
			}
		} catch (err) {
			console.warn('[i18n] Failed to read localStorage:', err);
		}
	}

	if (bffDefault === 'fr' || bffDefault === 'en') {
		return bffDefault;
	}

	if (typeof navigator !== 'undefined' && navigator.language) {
		const lang = navigator.language.toLowerCase();
		if (lang.startsWith('en')) return 'en';
		if (lang.startsWith('fr')) return 'fr';
	}

	return 'en';
}

/**
 * Initializes the locale at application startup.
 */
export function initLocale(bffDefault?: SupportedLocale): SupportedLocale {
	const initial = getInitialLocale(bffDefault);
	setLocale(initial, false);
	return initial;
}

/**
 * Returns the currently active locale.
 */
export function getLocale(): SupportedLocale {
	return currentLocale;
}

/**
 * Updates the active locale, synchronizes the DOM (<html lang="...">),
 * persists the preference to localStorage and notifies subscribers.
 */
export function setLocale(locale: SupportedLocale, persist = true): void {
	if (locale !== 'en' && locale !== 'fr') return;

	currentLocale = locale;

	if (typeof document !== 'undefined') {
		document.documentElement.lang = locale;
	}

	if (persist && typeof window !== 'undefined') {
		try {
			localStorage.setItem(KATO_LOCALE_STORAGE_KEY, locale);
		} catch (err) {
			console.warn('[i18n] Failed to write to localStorage:', err);
		}
	}

	for (const listener of listeners) {
		try {
			listener(currentLocale);
		} catch (err) {
			console.error('[i18n] Listener error:', err);
		}
	}
}

/**
 * Subscribes to locale changes.
 */
export function onLocaleChange(listener: LocaleListener): () => void {
	listeners.add(listener);
	listener(currentLocale);
	return () => {
		listeners.delete(listener);
	};
}

/**
 * Translation helper with placeholder variable interpolation.
 * Example: t('header.scoreAria', { countUp: 10, total: 12 })
 *
 * @param key Dot-separated key (e.g. 'common.appName', 'detailModal.closeBtn')
 * @param params Optional dictionary of interpolation parameters {name: value}
 * @returns Translated string with placeholders replaced
 */
export function t(
	key: TranslationKey | string,
	params?: Record<string, string | number>,
	locale?: SupportedLocale
): string {
	const loc = locale ?? currentLocale;
	const activeDict = dictionaries[loc] ?? dictionaries.fr;
	const parts = key.split('.');

	let val: unknown = activeDict;
	for (const part of parts) {
		if (val && typeof val === 'object' && part in val) {
			val = (val as Record<string, unknown>)[part];
		} else {
			val = undefined;
			break;
		}
	}

	// Fallback to French dictionary if key is missing in current locale
	if (typeof val !== 'string') {
		let fallbackVal: unknown = dictionaries.fr;
		for (const part of parts) {
			if (fallbackVal && typeof fallbackVal === 'object' && part in fallbackVal) {
				fallbackVal = (fallbackVal as Record<string, unknown>)[part];
			} else {
				fallbackVal = undefined;
				break;
			}
		}
		if (typeof fallbackVal === 'string') {
			val = fallbackVal;
		} else {
			return key;
		}
	}

	let str = val as string;
	if (params) {
		for (const [k, v] of Object.entries(params)) {
			str = str.replaceAll(`{${k}}`, String(v));
		}
	}

	return str;
}
