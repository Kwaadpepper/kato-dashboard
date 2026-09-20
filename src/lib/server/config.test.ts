import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { FALLBACK_SETTINGS, getDefaultClientSettings } from './config.ts';

describe('BFF config module', () => {
	it('should return fallback settings when no env vars are defined', () => {
		const settings = getDefaultClientSettings({});
		assert.deepEqual(settings, FALLBACK_SETTINGS);
	});

	it('should parse valid environment variables correctly', () => {
		const mockEnv = {
			KATO_DEFAULT_LOCALE: 'en',
			KATO_DEFAULT_THEME: 'amoled',
			KATO_DEFAULT_TIME_FORMAT: '12h',
			KATO_DEFAULT_TIME_ZONE: 'Europe/Paris',
			KATO_DEFAULT_SHOW_SECONDS: 'false',
			KATO_DEFAULT_SOUND_ENABLED: 'true',
			KATO_DEFAULT_MARQUEE_SPEED: 'fast',
			KATO_DEFAULT_SORT_MODE: 'alpha'
		};

		const settings = getDefaultClientSettings(mockEnv);

		assert.equal(settings.locale, 'en');
		assert.equal(settings.theme, 'amoled');
		assert.equal(settings.timeFormat, '12h');
		assert.equal(settings.timeZone, 'Europe/Paris');
		assert.equal(settings.showSeconds, false);
		assert.equal(settings.soundEnabled, true);
		assert.equal(settings.marqueeSpeed, 'fast');
		assert.equal(settings.sortMode, 'alpha');
	});

	it('should gracefully fall back on invalid or unknown values', () => {
		const invalidEnv = {
			KATO_DEFAULT_LOCALE: 'es', // unsupported
			KATO_DEFAULT_THEME: 'neon-pink', // unsupported
			KATO_DEFAULT_TIME_FORMAT: '48h',
			KATO_DEFAULT_SHOW_SECONDS: 'maybe',
			KATO_DEFAULT_SOUND_ENABLED: 'unknown',
			KATO_DEFAULT_MARQUEE_SPEED: 'hyperspeed',
			KATO_DEFAULT_SORT_MODE: 'random'
		};

		const settings = getDefaultClientSettings(invalidEnv);

		assert.equal(settings.locale, 'en');
		assert.equal(settings.theme, 'dark');
		assert.equal(settings.timeFormat, '24h');
		assert.equal(settings.showSeconds, true);
		assert.equal(settings.soundEnabled, false);
		assert.equal(settings.marqueeSpeed, 'slow');
		assert.equal(settings.sortMode, 'smart');
	});

	it('should support case-insensitive and trimmed values', () => {
		const messyEnv = {
			KATO_DEFAULT_LOCALE: '  EN  ',
			KATO_DEFAULT_THEME: '  LIGHT  ',
			KATO_DEFAULT_TIME_FORMAT: ' 12H ',
			KATO_DEFAULT_TIME_ZONE: ' America/New_York ',
			KATO_DEFAULT_SHOW_SECONDS: '1',
			KATO_DEFAULT_SOUND_ENABLED: 'yes',
			KATO_DEFAULT_MARQUEE_SPEED: 'NORMAL',
			KATO_DEFAULT_SORT_MODE: 'GROUP'
		};

		const settings = getDefaultClientSettings(messyEnv);

		assert.equal(settings.locale, 'en');
		assert.equal(settings.theme, 'light');
		assert.equal(settings.timeFormat, '12h');
		assert.equal(settings.timeZone, 'America/New_York');
		assert.equal(settings.showSeconds, true);
		assert.equal(settings.soundEnabled, true);
		assert.equal(settings.marqueeSpeed, 'normal');
		assert.equal(settings.sortMode, 'group');
	});
});
