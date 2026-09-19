/**
 * clock.ts
 *
 * Utilitaire de gestion de l'horloge pour Kato Dashboard.
 * Permet de configurer et persister :
 * - Le format d'affichage de l'heure : 24h ou 12h (AM/PM)
 * - Le fuseau horaire : Local, UTC, ou fuseau IANA personnalisé
 * - L'affichage ou masquage des secondes (showSeconds)
 */

export type TimeFormat = '24h' | '12h';

export interface ClockConfig {
	format: TimeFormat;
	timeZone: string; // 'local' ou identifiant IANA (ex: 'UTC', 'Europe/Paris')
	showSeconds: boolean;
}

export const CLOCK_FORMAT_STORAGE_KEY = 'kato-clock-format';
export const CLOCK_TIMEZONE_STORAGE_KEY = 'kato-clock-timezone';
export const CLOCK_SHOW_SECONDS_STORAGE_KEY = 'kato-clock-show-seconds';

export interface TimeZonePreset {
	id: string;
	label: string;
	short: string;
}

export const TIME_ZONE_PRESETS: readonly TimeZonePreset[] = [
	{ id: 'local', label: 'Local (Système)', short: 'LOC' },
	{ id: 'UTC', label: 'UTC (Temps Universel)', short: 'UTC' },
	{ id: 'Europe/Paris', label: 'Paris (CET/CEST)', short: 'PAR' },
	{ id: 'Europe/London', label: 'Londres (GMT/BST)', short: 'LON' },
	{ id: 'America/New_York', label: 'New York (EST/EDT)', short: 'NYC' },
	{ id: 'America/Los_Angeles', label: 'Los Angeles (PST/PDT)', short: 'LAX' },
	{ id: 'Asia/Tokyo', label: 'Tokyo (JST)', short: 'TYO' },
	{ id: 'Asia/Singapore', label: 'Singapour (SGT)', short: 'SIN' },
	{ id: 'Australia/Sydney', label: 'Sydney (AEST)', short: 'SYD' }
] as const;

type ClockListener = (config: ClockConfig) => void;
const listeners = new Set<ClockListener>();

let currentFormat: TimeFormat = '24h';
let currentTimeZone = 'local';
let currentShowSeconds = true;

function notifyListeners(): void {
	const config: ClockConfig = {
		format: currentFormat,
		timeZone: currentTimeZone,
		showSeconds: currentShowSeconds
	};
	for (const listener of listeners) {
		try {
			listener(config);
		} catch (err) {
			console.error('[Clock] Listener error:', err);
		}
	}
}

/**
 * Récupère le format initial depuis le localStorage ou les réglages BFF (défaut : '24h').
 */
export function getInitialTimeFormat(bffDefault?: TimeFormat): TimeFormat {
	if (typeof window !== 'undefined') {
		try {
			const saved = localStorage.getItem(CLOCK_FORMAT_STORAGE_KEY);
			if (saved === '12h' || saved === '24h') {
				return saved;
			}
		} catch (err) {
			console.warn('[Clock] Erreur lecture format horloge:', err);
		}
	}
	if (bffDefault === '12h' || bffDefault === '24h') {
		return bffDefault;
	}
	return '24h';
}

/**
 * Récupère le fuseau horaire initial depuis le localStorage ou les réglages BFF (défaut : 'local').
 */
export function getInitialTimeZone(bffDefault?: string): string {
	if (typeof window !== 'undefined') {
		try {
			const saved = localStorage.getItem(CLOCK_TIMEZONE_STORAGE_KEY);
			if (saved && typeof saved === 'string') {
				return saved;
			}
		} catch (err) {
			console.warn('[Clock] Erreur lecture fuseau horaire:', err);
		}
	}
	if (bffDefault && typeof bffDefault === 'string' && bffDefault.length > 0) {
		return bffDefault;
	}
	return 'local';
}

/**
 * Récupère la préférence d'affichage des secondes depuis le localStorage ou BFF (défaut : true).
 */
export function getInitialShowSeconds(bffDefault?: boolean): boolean {
	if (typeof window !== 'undefined') {
		try {
			const saved = localStorage.getItem(CLOCK_SHOW_SECONDS_STORAGE_KEY);
			if (saved !== null) {
				return saved === 'true';
			}
		} catch (err) {
			console.warn('[Clock] Erreur lecture affichage secondes:', err);
		}
	}
	if (typeof bffDefault === 'boolean') {
		return bffDefault;
	}
	return true;
}

/**
 * Initialise l'état de l'horloge depuis le stockage local et les réglages BFF.
 */
export function initClockConfig(bffDefaults?: Partial<ClockConfig>): ClockConfig {
	currentFormat = getInitialTimeFormat(bffDefaults?.format);
	currentTimeZone = getInitialTimeZone(bffDefaults?.timeZone);
	currentShowSeconds = getInitialShowSeconds(bffDefaults?.showSeconds);
	return {
		format: currentFormat,
		timeZone: currentTimeZone,
		showSeconds: currentShowSeconds
	};
}

/**
 * Définit le format d'affichage (24h ou 12h) et persiste dans le localStorage.
 */
export function setTimeFormat(format: TimeFormat): void {
	if (format !== '24h' && format !== '12h') return;
	currentFormat = format;

	if (typeof window !== 'undefined') {
		try {
			localStorage.setItem(CLOCK_FORMAT_STORAGE_KEY, format);
		} catch (err) {
			console.warn('[Clock] Erreur écriture format horloge:', err);
		}
	}

	notifyListeners();
}

/**
 * Définit le fuseau horaire et persiste dans le localStorage.
 */
export function setTimeZone(timeZone: string): void {
	currentTimeZone = timeZone;

	if (typeof window !== 'undefined') {
		try {
			localStorage.setItem(CLOCK_TIMEZONE_STORAGE_KEY, timeZone);
		} catch (err) {
			console.warn('[Clock] Erreur écriture fuseau horaire:', err);
		}
	}

	notifyListeners();
}

/**
 * Active ou désactive l'affichage des secondes et persiste dans le localStorage.
 */
export function setShowSeconds(show: boolean): void {
	currentShowSeconds = show;

	if (typeof window !== 'undefined') {
		try {
			localStorage.setItem(CLOCK_SHOW_SECONDS_STORAGE_KEY, show.toString());
		} catch (err) {
			console.warn('[Clock] Erreur écriture affichage secondes:', err);
		}
	}

	notifyListeners();
}

/**
 * Retourne la configuration courante de l'horloge.
 */
export function getClockConfig(): ClockConfig {
	return {
		format: currentFormat,
		timeZone: currentTimeZone,
		showSeconds: currentShowSeconds
	};
}

/**
 * S'abonne aux changements de configuration de l'horloge.
 */
export function onClockConfigChange(listener: ClockListener): () => void {
	listeners.add(listener);
	listener({
		format: currentFormat,
		timeZone: currentTimeZone,
		showSeconds: currentShowSeconds
	});
	return () => {
		listeners.delete(listener);
	};
}

import type { SupportedLocale } from '$lib/types';

/**
 * Formate une date selon la configuration d'horloge spécifiée.
 *
 * @param date Objet Date à formater
 * @param config Configuration (format 12h/24h, timeZone et showSeconds)
 * @param options Options complémentaires (ex: forceNoSeconds, includeZoneSuffix, locale)
 */
export function formatClock(
	date: Date,
	config: ClockConfig,
	options: { forceNoSeconds?: boolean; includeZoneSuffix?: boolean; locale?: SupportedLocale } = {}
): string {
	const { forceNoSeconds = false, includeZoneSuffix = false, locale } = options;
	const is12h = config.format === '12h';
	const ianaTimeZone = config.timeZone === 'local' ? undefined : config.timeZone;
	const shouldIncludeSeconds = config.showSeconds && !forceNoSeconds;
	const localeCode = locale ? (locale === 'fr' ? 'fr-FR' : 'en-US') : (is12h ? 'en-US' : 'fr-FR');

	try {
		const timeString = date.toLocaleTimeString(localeCode, {
			hour: '2-digit',
			minute: '2-digit',
			second: shouldIncludeSeconds ? '2-digit' : undefined,
			hour12: is12h,
			timeZone: ianaTimeZone
		});

		if (includeZoneSuffix && config.timeZone !== 'local') {
			const preset = TIME_ZONE_PRESETS.find((p) => p.id === config.timeZone);
			const label = preset ? preset.short : config.timeZone;
			return `${timeString} ${label}`;
		}

		return timeString;
	} catch {
		// Repli de secours en cas d'identifiant de fuseau invalide
		return date.toLocaleTimeString(localeCode, {
			hour: '2-digit',
			minute: '2-digit',
			second: shouldIncludeSeconds ? '2-digit' : undefined,
			hour12: is12h
		});
	}
}

/**
 * Retourne le libellé court du fuseau horaire pour affichage condensé.
 */
export function getTimeZoneShortLabel(timeZone: string): string {
	const preset = TIME_ZONE_PRESETS.find((p) => p.id === timeZone);
	return preset ? preset.short : timeZone;
}
