import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
	getInitialTimeFormat,
	getInitialTimeZone,
	getInitialShowSeconds,
	setTimeFormat,
	setTimeZone,
	setShowSeconds,
	getClockConfig,
	onClockConfigChange,
	formatClock,
	getTimeZoneShortLabel,
	CLOCK_FORMAT_STORAGE_KEY,
	CLOCK_TIMEZONE_STORAGE_KEY,
	CLOCK_SHOW_SECONDS_STORAGE_KEY
} from './clock.ts';

// Mock minimal de window et localStorage pour tests Node
class MockLocalStorage {
	private store = new Map<string, string>();

	getItem(key: string): string | null {
		return this.store.get(key) ?? null;
	}

	setItem(key: string, value: string): void {
		this.store.set(key, value);
	}

	removeItem(key: string): void {
		this.store.delete(key);
	}

	clear(): void {
		this.store.clear();
	}
}

const mockStorage = new MockLocalStorage();
(globalThis as unknown as { window: unknown }).window = globalThis;
(globalThis as unknown as { localStorage: unknown }).localStorage = mockStorage;

describe('clock utility module', () => {
	beforeEach(() => {
		mockStorage.clear();
		setTimeFormat('24h');
		setTimeZone('local');
		setShowSeconds(true);
	});

	it('should default to 24h format, local timezone and showSeconds=true when localStorage is empty', () => {
		assert.equal(getInitialTimeFormat(), '24h');
		assert.equal(getInitialTimeZone(), 'local');
		assert.equal(getInitialShowSeconds(), true);
	});

	it('should persist time format to localStorage when changed', () => {
		setTimeFormat('12h');
		assert.equal(mockStorage.getItem(CLOCK_FORMAT_STORAGE_KEY), '12h');
		assert.equal(getClockConfig().format, '12h');

		setTimeFormat('24h');
		assert.equal(mockStorage.getItem(CLOCK_FORMAT_STORAGE_KEY), '24h');
		assert.equal(getClockConfig().format, '24h');
	});

	it('should persist timezone to localStorage when changed', () => {
		setTimeZone('UTC');
		assert.equal(mockStorage.getItem(CLOCK_TIMEZONE_STORAGE_KEY), 'UTC');
		assert.equal(getClockConfig().timeZone, 'UTC');

		setTimeZone('Europe/Paris');
		assert.equal(mockStorage.getItem(CLOCK_TIMEZONE_STORAGE_KEY), 'Europe/Paris');
		assert.equal(getClockConfig().timeZone, 'Europe/Paris');
	});

	it('should persist showSeconds preference to localStorage', () => {
		setShowSeconds(false);
		assert.equal(mockStorage.getItem(CLOCK_SHOW_SECONDS_STORAGE_KEY), 'false');
		assert.equal(getClockConfig().showSeconds, false);

		setShowSeconds(true);
		assert.equal(mockStorage.getItem(CLOCK_SHOW_SECONDS_STORAGE_KEY), 'true');
		assert.equal(getClockConfig().showSeconds, true);
	});

	it('should notify subscribers on format, timezone or showSeconds change', () => {
		let currentFmt = '';
		let currentTz = '';
		let currentSec = true;

		const unsubscribe = onClockConfigChange((cfg) => {
			currentFmt = cfg.format;
			currentTz = cfg.timeZone;
			currentSec = cfg.showSeconds;
		});

		assert.equal(currentFmt, '24h');
		assert.equal(currentTz, 'local');
		assert.equal(currentSec, true);

		setTimeFormat('12h');
		assert.equal(currentFmt, '12h');

		setTimeZone('America/New_York');
		assert.equal(currentTz, 'America/New_York');

		setShowSeconds(false);
		assert.equal(currentSec, false);

		unsubscribe();
	});

	it('should format 24h and 12h accurately and respect showSeconds', () => {
		// 2026-09-19T14:30:45Z
		const fixedDate = new Date('2026-09-19T14:30:45Z');

		const formatted24hWithSec = formatClock(fixedDate, { format: '24h', timeZone: 'UTC', showSeconds: true });
		assert.match(formatted24hWithSec, /14:30:45/);

		const formatted24hNoSec = formatClock(fixedDate, { format: '24h', timeZone: 'UTC', showSeconds: false });
		assert.match(formatted24hNoSec, /14:30/);
		assert.ok(!formatted24hNoSec.includes(':45'));

		const formatted12hWithSec = formatClock(fixedDate, { format: '12h', timeZone: 'UTC', showSeconds: true });
		assert.match(formatted12hWithSec, /02:30:45\s*PM/i);

		const formatted12hNoSec = formatClock(fixedDate, { format: '12h', timeZone: 'UTC', showSeconds: false });
		assert.match(formatted12hNoSec, /02:30\s*PM/i);
		assert.ok(!formatted12hNoSec.includes(':45'));
	});

	it('should format time with timezone suffix when requested', () => {
		const fixedDate = new Date('2026-09-19T14:30:45Z');
		const withSuffix = formatClock(
			fixedDate,
			{ format: '24h', timeZone: 'UTC', showSeconds: true },
			{ includeZoneSuffix: true }
		);
		assert.ok(withSuffix.endsWith('UTC'));
	});

	it('should return short label for predefined timezones', () => {
		assert.equal(getTimeZoneShortLabel('UTC'), 'UTC');
		assert.equal(getTimeZoneShortLabel('Europe/Paris'), 'PAR');
		assert.equal(getTimeZoneShortLabel('America/New_York'), 'NYC');
		assert.equal(getTimeZoneShortLabel('Custom/Zone'), 'Custom/Zone');
	});
});
