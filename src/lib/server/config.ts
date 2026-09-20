import type {
    ClientDefaultSettings,
    MarqueeSpeed,
    SortMode,
    SupportedLocale,
    Theme,
    TimeFormat
} from '$lib/types';

/**
 * Strict fallback defaults applied when corresponding environment variables are absent.
 */
export const FALLBACK_SETTINGS: ClientDefaultSettings = {
	locale: 'en',
	theme: 'dark',
	timeFormat: '24h',
	timeZone: 'local',
	showSeconds: true,
	soundEnabled: false,
	marqueeSpeed: 'slow',
	sortMode: 'smart'
};

const VALID_LOCALES: ReadonlySet<string> = new Set<SupportedLocale>(['en', 'fr']);
const VALID_THEMES: ReadonlySet<string> = new Set<Theme>(['dark', 'light', 'amoled', 'auto']);
const VALID_TIME_FORMATS: ReadonlySet<string> = new Set<TimeFormat>(['24h', '12h']);
const VALID_MARQUEE_SPEEDS: ReadonlySet<string> = new Set<MarqueeSpeed>(['slow', 'normal', 'fast']);
const VALID_SORT_MODES: ReadonlySet<string> = new Set<SortMode>(['smart', 'alpha', 'group']);

function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
	if (!value) return defaultValue;
	const lower = value.trim().toLowerCase();
	if (lower === 'true' || lower === '1' || lower === 'yes') return true;
	if (lower === 'false' || lower === '0' || lower === 'no') return false;
	return defaultValue;
}

/**
 * Extracts and validates server-configured default client settings.
 * Defaults to reading `process.env` or an injected environment map (useful in tests).
 *
 * @param env Optional environment variables dictionary
 * @returns Strongly-typed safe client settings object
 */
export function getDefaultClientSettings(
	env: Record<string, string | undefined> = process.env
): ClientDefaultSettings {
	// 1. Locale
	const rawLocale = env.KATO_DEFAULT_LOCALE?.trim().toLowerCase();
	const locale: SupportedLocale =
		rawLocale && VALID_LOCALES.has(rawLocale) ? (rawLocale as SupportedLocale) : FALLBACK_SETTINGS.locale;

	// 2. Theme
	const rawTheme = env.KATO_DEFAULT_THEME?.trim().toLowerCase();
	const theme: Theme =
		rawTheme && VALID_THEMES.has(rawTheme) ? (rawTheme as Theme) : FALLBACK_SETTINGS.theme;

	// 3. Time format
	const rawFormat = env.KATO_DEFAULT_TIME_FORMAT?.trim().toLowerCase();
	const timeFormat: TimeFormat =
		rawFormat && VALID_TIME_FORMATS.has(rawFormat)
			? (rawFormat as TimeFormat)
			: FALLBACK_SETTINGS.timeFormat;

	// 4. Timezone
	const rawTimeZone = env.KATO_DEFAULT_TIME_ZONE?.trim();
	const timeZone = rawTimeZone && rawTimeZone.length > 0 ? rawTimeZone : FALLBACK_SETTINGS.timeZone;

	// 5. Show seconds
	const showSeconds = parseBoolean(env.KATO_DEFAULT_SHOW_SECONDS, FALLBACK_SETTINGS.showSeconds);

	// 6. Sound alerts
	const soundEnabled = parseBoolean(env.KATO_DEFAULT_SOUND_ENABLED, FALLBACK_SETTINGS.soundEnabled);

	// 7. Marquee speed
	const rawSpeed = env.KATO_DEFAULT_MARQUEE_SPEED?.trim().toLowerCase();
	const marqueeSpeed: MarqueeSpeed =
		rawSpeed && VALID_MARQUEE_SPEEDS.has(rawSpeed)
			? (rawSpeed as MarqueeSpeed)
			: FALLBACK_SETTINGS.marqueeSpeed;

	// 8. Sort mode
	const rawSort = env.KATO_DEFAULT_SORT_MODE?.trim().toLowerCase();
	const sortMode: SortMode =
		rawSort && VALID_SORT_MODES.has(rawSort)
			? (rawSort as SortMode)
			: FALLBACK_SETTINGS.sortMode;

	return {
		locale,
		theme,
		timeFormat,
		timeZone,
		showSeconds,
		soundEnabled,
		marqueeSpeed,
		sortMode
	};
}
