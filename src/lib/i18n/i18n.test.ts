import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
	getInitialLocale,
	getLocale,
	initLocale,
	setLocale,
	onLocaleChange,
	t,
	KATO_LOCALE_STORAGE_KEY
} from './index.ts';
import { fr } from './locales/fr.ts';
import { en } from './locales/en.ts';

// Recursive helper to extract all deep keys from an object
function getDeepKeys(obj: Record<string, unknown>, prefix = ''): string[] {
	let keys: string[] = [];
	for (const [key, value] of Object.entries(obj)) {
		const fullKey = prefix ? `${prefix}.${key}` : key;
		if (value && typeof value === 'object' && !Array.isArray(value)) {
			keys = keys.concat(getDeepKeys(value as Record<string, unknown>, fullKey));
		} else {
			keys.push(fullKey);
		}
	}
	return keys;
}

describe('i18n module', () => {
	beforeEach(() => {
		// Mock localStorage
		const storage = new Map<string, string>();
		// @ts-expect-error Minimal mock
		globalThis.localStorage = {
			getItem: (key: string) => storage.get(key) ?? null,
			setItem: (key: string, val: string) => {
				storage.set(key, val);
			},
			removeItem: (key: string) => {
				storage.delete(key);
			},
			clear: () => {
				storage.clear();
			}
		};

		// Mock document.documentElement
		(globalThis as unknown as { document: unknown }).document = {
			documentElement: {
				lang: 'en'
			}
		};

		// Mock window and navigator
		(globalThis as unknown as { window: unknown }).window = {};
		Object.defineProperty(globalThis, 'navigator', {
			value: { language: '' },
			configurable: true,
			writable: true
		});

		// Reset to default
		setLocale('en', false);
	});

	it('should have 100% key parity between French and English dictionaries', () => {
		const frKeys = getDeepKeys(fr as unknown as Record<string, unknown>).sort();
		const enKeys = getDeepKeys(en as unknown as Record<string, unknown>).sort();

		assert.deepEqual(
			frKeys,
			enKeys,
			'Every key defined in French must be present in English and vice-versa'
		);

		// Verify no string is empty
		for (const key of frKeys) {
			assert.ok(t(key).length > 0, `Key ${key} in French must not be empty`);
		}
	});

	it('should translate correctly in English by default', () => {
		setLocale('en', false);
		assert.equal(t('common.appName'), 'KATO');
		assert.equal(t('status.up'), 'Operational');
		assert.equal(t('status.down'), 'Down');
		assert.equal(t('settings.sectionLanguage'), 'Language');
	});

	it('should translate correctly in French when locale is switched', () => {
		setLocale('fr', false);
		assert.equal(t('common.appName'), 'KATO');
		assert.equal(t('status.up'), 'Opérationnel');
		assert.equal(t('status.down'), 'En panne');
		assert.equal(t('settings.sectionLanguage'), 'Langue');
	});

	it('should correctly interpolate variables in translation strings', () => {
		setLocale('fr', false);
		const frScore = t('header.scoreAria', { countUp: 12, total: 15 });
		assert.equal(frScore, '12 sur 15 sondes opérationnelles');

		setLocale('en', false);
		const enScore = t('header.scoreAria', { countUp: 12, total: 15 });
		assert.equal(enScore, '12 of 15 operational probes');
	});

	it('should notify subscribers when locale changes', () => {
		const calls: string[] = [];
		const unsubscribe = onLocaleChange((locale) => {
			calls.push(locale);
		});

		setLocale('fr', false);
		setLocale('en', false);

		assert.deepEqual(calls, ['en', 'fr', 'en']);
		unsubscribe();
	});

	it('should respect hierarchy in getInitialLocale (localStorage > bffDefault > fallback)', () => {
		// 1. Fallback when nothing is provided
		assert.equal(getInitialLocale(), 'en');

		// 2. BFF default considered
		assert.equal(getInitialLocale('fr'), 'fr');

		// 3. LocalStorage takes precedence over BFF default
		localStorage.setItem(KATO_LOCALE_STORAGE_KEY, 'fr');
		assert.equal(getInitialLocale('en'), 'fr');

		localStorage.setItem(KATO_LOCALE_STORAGE_KEY, 'en');
		assert.equal(getInitialLocale('fr'), 'en');

		// 4. Browser language fallback when localStorage and bffDefault are absent
		localStorage.clear();
		Object.defineProperty(globalThis, 'navigator', {
			value: { language: 'fr-CA' },
			configurable: true,
			writable: true
		});
		assert.equal(getInitialLocale(), 'fr');
	});

	it('should return the key itself if not found', () => {
		assert.equal(t('non.existent.key'), 'non.existent.key');
	});

	it('should initialize locale with initLocale and retrieve with getLocale', () => {
		initLocale('en');
		assert.equal(getLocale(), 'en');

		initLocale('fr');
		assert.equal(getLocale(), 'fr');
	});
});
