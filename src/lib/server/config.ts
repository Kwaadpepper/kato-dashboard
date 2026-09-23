import type {
    AdapterInstanceConfig,
    AdapterProviderType,
    ClientDefaultSettings,
    KatoAppConfig,
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

// ============================================================================
// ADAPTERS & GLOBAL CONFIGURATION
// ============================================================================

const VALID_ADAPTER_TYPES: ReadonlySet<string> = new Set<AdapterProviderType>([
	'mock',
	'uptimerobot',
	'uptimekuma'
]);

/**
 * Loads and validates repeatable adapter instance configurations from environment variables.
 *
 * Supports two configuration modes:
 * 1. Named instances mode via KATO_ADAPTERS:
 *    KATO_ADAPTERS=kuma_prod,kuma_interne,robot_main
 *    ADAPTER_KUMA_PROD_TYPE=uptimekuma
 *    ADAPTER_KUMA_PROD_URL=...
 *
 * 2. Legacy / simple mode via KATO_ADAPTER (single or comma-separated):
 *    KATO_ADAPTER=uptimerobot,uptimekuma
 *    UPTIMEROBOT_API_KEY=...
 *    UPTIME_KUMA_URL=...
 *
 * Falls back to a single 'mock' adapter if nothing is configured or invalid.
 */
export function loadAdaptersConfig(
	env: Record<string, string | undefined> = process.env
): AdapterInstanceConfig[] {
	const configs: AdapterInstanceConfig[] = [];

	// ── 1. Named instances mode (KATO_ADAPTERS) ──────────────────────────────
	const rawAdapters = env.KATO_ADAPTERS?.trim();
	if (rawAdapters) {
		const aliases = rawAdapters.split(',').map((s) => s.trim()).filter(Boolean);

		for (const alias of aliases) {
			const aliasUpper = alias.toUpperCase().replace(/[^A-Z0-9_]/g, '_');
			const rawType = env[`ADAPTER_${aliasUpper}_TYPE`]?.trim().toLowerCase();

			let type: AdapterProviderType;
			if (rawType && VALID_ADAPTER_TYPES.has(rawType)) {
				type = rawType as AdapterProviderType;
			} else if (alias.toLowerCase().includes('kuma')) {
				type = 'uptimekuma';
			} else if (alias.toLowerCase().includes('robot')) {
				type = 'uptimerobot';
			} else {
				type = 'mock';
			}

			const rawInterval = env[`ADAPTER_${aliasUpper}_POLL_INTERVAL`]?.trim();
			const pollInterval = rawInterval ? Number.parseInt(rawInterval, 10) : undefined;

			if (type === 'mock') {
				const rawCount = env[`ADAPTER_${aliasUpper}_COUNT`]?.trim();
				const count = rawCount ? Number.parseInt(rawCount, 10) : undefined;
				configs.push({
					id: alias,
					type: 'mock',
					count: count && !Number.isNaN(count) ? count : 50,
					...(pollInterval && !Number.isNaN(pollInterval) ? { pollInterval } : {})
				});
			} else if (type === 'uptimerobot') {
				const apiKey = env[`ADAPTER_${aliasUpper}_API_KEY`]?.trim() ?? '';
				configs.push({
					id: alias,
					type: 'uptimerobot',
					apiKey,
					pollInterval: pollInterval && !Number.isNaN(pollInterval) ? pollInterval : 30000
				});
			} else if (type === 'uptimekuma') {
				const baseUrl = env[`ADAPTER_${aliasUpper}_URL`]?.trim() ?? '';
				const apiKey = env[`ADAPTER_${aliasUpper}_API_KEY`]?.trim();
				configs.push({
					id: alias,
					type: 'uptimekuma',
					baseUrl,
					apiKey: apiKey || undefined,
					pollInterval: pollInterval && !Number.isNaN(pollInterval) ? pollInterval : 60000
				});
			}
		}

		if (configs.length > 0) {
			return configs;
		}
	}

	// ── 2. Legacy / simple mode (KATO_ADAPTER or ADAPTER_TYPE) ───────────────
	const legacyAdapters = (env.KATO_ADAPTER || env.ADAPTER_TYPE || 'mock').trim();
	const tokens = legacyAdapters.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);

	for (const token of tokens) {
		if (token === 'uptimerobot') {
			const apiKey = env.UPTIMEROBOT_API_KEY?.trim() ?? '';
			const rawInterval = env.UPTIMEROBOT_POLL_INTERVAL?.trim();
			const pollInterval = rawInterval ? Number.parseInt(rawInterval, 10) : 30000;
			configs.push({
				id: 'uptimerobot',
				type: 'uptimerobot',
				apiKey,
				pollInterval: !Number.isNaN(pollInterval) ? pollInterval : 30000
			});
		} else if (token === 'uptimekuma') {
			const baseUrl = env.UPTIME_KUMA_URL?.trim() ?? '';
			const apiKey = env.UPTIME_KUMA_API_KEY?.trim();
			const rawInterval = env.UPTIME_KUMA_POLL_INTERVAL?.trim();
			const pollInterval = rawInterval ? Number.parseInt(rawInterval, 10) : 60000;
			configs.push({
				id: 'uptimekuma',
				type: 'uptimekuma',
				baseUrl,
				apiKey: apiKey || undefined,
				pollInterval: !Number.isNaN(pollInterval) ? pollInterval : 60000
			});
		} else if (token === 'mock') {
			const rawCount = env.KATO_MOCK_COUNT?.trim();
			const count = rawCount ? Number.parseInt(rawCount, 10) : 50;
			configs.push({
				id: 'mock',
				type: 'mock',
				count: !Number.isNaN(count) ? count : 50
			});
		}
	}

	// ── 3. Ultimate fallback ────────────────────────────────────────────────
	if (configs.length === 0) {
		configs.push({
			id: 'mock',
			type: 'mock',
			count: 50
		});
	}

	return configs;
}

/**
 * Builds the full application configuration object.
 */
export function getAppConfig(
	env: Record<string, string | undefined> = process.env
): KatoAppConfig {
	const adapters = loadAdaptersConfig(env);
	const authEnabled = parseBoolean(env.KATO_AUTH_ENABLED, false);
	const authPassword = env.KATO_AUTH_PASSWORD ?? null;
	const port = Number.parseInt(env.PORT ?? '3000', 10);
	const host = env.HOST ?? '0.0.0.0';
	const defaultSettings = getDefaultClientSettings(env);

	return {
		adapters,
		authEnabled,
		authPassword,
		port: !Number.isNaN(port) ? port : 3000,
		host,
		defaultSettings
	};
}

