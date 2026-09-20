import type { SupportedLocale, TranslationKey, TranslationSchema } from './types.ts';
export type { SupportedLocale, TranslationKey, TranslationSchema };
import { fr } from './locales/fr.ts';
import { en } from './locales/en.ts';

export const KATO_LOCALE_STORAGE_KEY = 'kato-locale';

const dictionaries: Record<SupportedLocale, TranslationSchema> = {
	fr,
	en
};

export const LOCALE_OPTIONS: Array<{ id: SupportedLocale; label: string; flag: string }> = [
	{ id: 'fr', label: 'Français', flag: '🇫🇷' },
	{ id: 'en', label: 'English', flag: '🇬🇧' }
];

type LocaleListener = (locale: SupportedLocale) => void;
const listeners = new Set<LocaleListener>();

let currentLocale: SupportedLocale = 'fr';

/**
 * Détermine la locale initiale en respectant la hiérarchie :
 * 1. Choix explicite dans `localStorage`
 * 2. Réglage par défaut transmis par le BFF
 * 3. Langue du navigateur (`navigator.language`)
 * 4. Repli 'fr'
 */
export function getInitialLocale(bffDefault?: SupportedLocale): SupportedLocale {
	if (typeof window !== 'undefined') {
		try {
			const saved = localStorage.getItem(KATO_LOCALE_STORAGE_KEY);
			if (saved === 'fr' || saved === 'en') {
				return saved;
			}
		} catch (err) {
			console.warn('[i18n] Impossible de lire localStorage:', err);
		}
	}

	if (bffDefault === 'fr' || bffDefault === 'en') {
		return bffDefault;
	}

	if (typeof navigator !== 'undefined' && navigator.language) {
		const lang = navigator.language.toLowerCase();
		if (lang.startsWith('fr')) return 'fr';
		if (lang.startsWith('en')) return 'en';
	}

	return 'fr';
}

/**
 * Initialise la locale au démarrage de l'application.
 */
export function initLocale(bffDefault?: SupportedLocale): SupportedLocale {
	const initial = getInitialLocale(bffDefault);
	setLocale(initial, false);
	return initial;
}

/**
 * Retourne la locale actuellement active.
 */
export function getLocale(): SupportedLocale {
	return currentLocale;
}

/**
 * Modifie la locale active, met à jour le DOM (<html lang="...">),
 * persiste dans le localStorage et notifie les abonnés.
 */
export function setLocale(locale: SupportedLocale, persist = true): void {
	if (locale !== 'fr' && locale !== 'en') return;

	currentLocale = locale;

	if (typeof document !== 'undefined') {
		document.documentElement.lang = locale;
	}

	if (persist && typeof window !== 'undefined') {
		try {
			localStorage.setItem(KATO_LOCALE_STORAGE_KEY, locale);
		} catch (err) {
			console.warn('[i18n] Impossible d\'écrire dans localStorage:', err);
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
 * S'abonne aux changements de langue.
 */
export function onLocaleChange(listener: LocaleListener): () => void {
	listeners.add(listener);
	listener(currentLocale);
	return () => {
		listeners.delete(listener);
	};
}

/**
 * Fonction de traduction avec interpolation de variables.
 * Ex: t('header.scoreAria', { countUp: 10, total: 12 })
 *
 * @param key Clé pointée (e.g. 'common.appName', 'detailModal.closeBtn')
 * @param params Dictionnaire optionnel de paramètres d'interpolation {nom: valeur}
 * @returns La chaîne traduite, avec les placeholders remplacés
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

	// Repli sur le dictionnaire français si la clé est manquante dans la locale courante
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
