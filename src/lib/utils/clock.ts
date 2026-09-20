/**
 * clock.ts
 *
 * Clock utility module for Kato Dashboard.
 * Manages configuration and persistence for:
 * - Time format: 24h or 12h (AM/PM)
 * - Timezone: Local, UTC, or custom IANA timezone
 * - Seconds display toggle (showSeconds)
 */

import type { SupportedLocale } from '$lib/types';

export type TimeFormat = '24h' | '12h';

export interface ClockConfig {
	format: TimeFormat;
	timeZone: string; // 'local' or IANA identifier (e.g. 'UTC', 'America/New_York')
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
	{ id: 'local', label: 'Local (System)', short: 'LOC' },
	{ id: 'UTC', label: 'UTC (Coordinated Universal Time)', short: 'UTC' },
	{ id: 'Europe/London', label: 'London (GMT/BST)', short: 'LON' },
	{ id: 'Europe/Paris', label: 'Paris (CET/CEST)', short: 'PAR' },
	{ id: 'America/New_York', label: 'New York (EST/EDT)', short: 'NYC' },
	{ id: 'America/Los_Angeles', label: 'Los Angeles (PST/PDT)', short: 'LAX' },
	{ id: 'Asia/Tokyo', label: 'Tokyo (JST)', short: 'TYO' },
	{ id: 'Asia/Singapore', label: 'Singapore (SGT)', short: 'SIN' },
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
 * Retrieves the initial time format from localStorage or BFF settings (default: '24h').
 */
export function getInitialTimeFormat(bffDefault?: TimeFormat): TimeFormat {
	if (typeof window !== 'undefined') {
		try {
			const saved = localStorage.getItem(CLOCK_FORMAT_STORAGE_KEY);
			if (saved === '12h' || saved === '24h') {
				return saved;
			}
		} catch (err) {
			console.warn('[Clock] Error reading time format:', err);
		}
	}
	if (bffDefault === '12h' || bffDefault === '24h') {
		return bffDefault;
	}
	return '24h';
}

/**
 * Retrieves the initial timezone from localStorage or BFF settings (default: 'local').
 */
export function getInitialTimeZone(bffDefault?: string): string {
	if (typeof window !== 'undefined') {
		try {
			const saved = localStorage.getItem(CLOCK_TIMEZONE_STORAGE_KEY);
			if (saved && typeof saved === 'string') {
				return saved;
			}
		} catch (err) {
			console.warn('[Clock] Error reading timezone:', err);
		}
	}
	if (bffDefault && typeof bffDefault === 'string' && bffDefault.length > 0) {
		return bffDefault;
	}
	return 'local';
}

/**
 * Retrieves the seconds display preference from localStorage or BFF settings (default: true).
 */
export function getInitialShowSeconds(bffDefault?: boolean): boolean {
	if (typeof window !== 'undefined') {
		try {
			const saved = localStorage.getItem(CLOCK_SHOW_SECONDS_STORAGE_KEY);
			if (saved !== null) {
				return saved === 'true';
			}
		} catch (err) {
			console.warn('[Clock] Error reading show seconds preference:', err);
		}
	}
	if (typeof bffDefault === 'boolean') {
		return bffDefault;
	}
	return true;
}

/**
 * Initializes clock state from local storage and BFF defaults.
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
 * Sets the clock display format (24h or 12h) and persists to localStorage.
 */
export function setTimeFormat(format: TimeFormat): void {
	if (format !== '24h' && format !== '12h') return;
	currentFormat = format;

	if (typeof window !== 'undefined') {
		try {
			localStorage.setItem(CLOCK_FORMAT_STORAGE_KEY, format);
		} catch (err) {
			console.warn('[Clock] Error writing time format:', err);
		}
	}

	notifyListeners();
}

/**
 * Sets the active timezone and persists to localStorage.
 */
export function setTimeZone(timeZone: string): void {
	currentTimeZone = timeZone;

	if (typeof window !== 'undefined') {
		try {
			localStorage.setItem(CLOCK_TIMEZONE_STORAGE_KEY, timeZone);
		} catch (err) {
			console.warn('[Clock] Error writing timezone:', err);
		}
	}

	notifyListeners();
}

/**
 * Toggles seconds display and persists to localStorage.
 */
export function setShowSeconds(show: boolean): void {
	currentShowSeconds = show;

	if (typeof window !== 'undefined') {
		try {
			localStorage.setItem(CLOCK_SHOW_SECONDS_STORAGE_KEY, show.toString());
		} catch (err) {
			console.warn('[Clock] Error writing show seconds preference:', err);
		}
	}

	notifyListeners();
}

/**
 * Returns the current clock configuration.
 */
export function getClockConfig(): ClockConfig {
	return {
		format: currentFormat,
		timeZone: currentTimeZone,
		showSeconds: currentShowSeconds
	};
}

/**
 * Subscribes to clock configuration changes.
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

/**
 * Formats a date according to the given clock configuration.
 *
 * @param date Date object to format
 * @param config Clock configuration
 * @param options Supplementary formatting options
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
	const localeCode = locale ? (locale === 'fr' ? 'fr-FR' : 'en-US') : 'en-US';

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
		// Fallback formatting on invalid timezone identifier
		return date.toLocaleTimeString(localeCode, {
			hour: '2-digit',
			minute: '2-digit',
			second: shouldIncludeSeconds ? '2-digit' : undefined,
			hour12: is12h
		});
	}
}

/**
 * Returns a short label for a timezone preset.
 */
export function getTimeZoneShortLabel(timeZone: string): string {
	const preset = TIME_ZONE_PRESETS.find((p) => p.id === timeZone);
	return preset ? preset.short : timeZone;
}
