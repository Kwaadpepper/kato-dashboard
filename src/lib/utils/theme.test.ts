import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

describe('theme utility module', () => {
	let mockStorage: Record<string, string> = {};
	let docAttributes: Record<string, string> = {};
	let mediaListeners: Array<(e: any) => void> = [];
	let prefersDark = true;

	beforeEach(() => {
		mockStorage = {};
		docAttributes = {};
		mediaListeners = [];
		prefersDark = true;

		// Mock localStorage
		(globalThis as any).localStorage = {
			getItem: (key: string) => mockStorage[key] ?? null,
			setItem: (key: string, value: string) => {
				mockStorage[key] = value;
			},
			removeItem: (key: string) => {
				delete mockStorage[key];
			},
			clear: () => {
				mockStorage = {};
			}
		};

		// Mock document.documentElement
		(globalThis as any).document = {
			documentElement: {
				setAttribute: (name: string, value: string) => {
					docAttributes[name] = value;
				},
				getAttribute: (name: string) => docAttributes[name] ?? null,
				style: {
					colorScheme: ''
				}
			}
		};

		// Mock window & window.matchMedia
		(globalThis as any).window = {
			matchMedia: (query: string) => ({
				matches: prefersDark,
				media: query,
				onchange: null,
				addEventListener: (event: string, handler: any) => {
					if (event === 'change') mediaListeners.push(handler);
				},
				removeEventListener: (event: string, handler: any) => {
					mediaListeners = mediaListeners.filter((h) => h !== handler);
				}
			})
		};
	});

	it('should default to dark theme when no localStorage value exists', async () => {
		const { getInitialTheme, resolveTheme } = await import('./theme.ts');
		assert.equal(getInitialTheme(), 'dark');
		assert.equal(resolveTheme('dark'), 'dark');
	});

	it('should read stored theme from localStorage', async () => {
		mockStorage['kato-theme'] = 'amoled';
		const { getInitialTheme } = await import('./theme.ts');
		assert.equal(getInitialTheme(), 'amoled');
	});

	it('should fallback to dark if stored theme is invalid', async () => {
		mockStorage['kato-theme'] = 'invalid-theme';
		const { getInitialTheme } = await import('./theme.ts');
		assert.equal(getInitialTheme(), 'dark');
	});

	it('should resolve auto theme based on prefers-color-scheme', async () => {
		const { resolveTheme } = await import('./theme.ts');

		prefersDark = true;
		assert.equal(resolveTheme('auto'), 'dark');

		prefersDark = false;
		assert.equal(resolveTheme('auto'), 'light');
	});

	it('should apply theme, update data-theme and persist to localStorage', async () => {
		const { applyTheme, getCurrentTheme, getResolvedTheme } = await import('./theme.ts');

		applyTheme('light');
		assert.equal(mockStorage['kato-theme'], 'light');
		assert.equal(docAttributes['data-theme'], 'light');
		assert.equal(docAttributes['data-theme-mode'], 'light');
		assert.equal(getCurrentTheme(), 'light');
		assert.equal(getResolvedTheme(), 'light');

		applyTheme('amoled');
		assert.equal(mockStorage['kato-theme'], 'amoled');
		assert.equal(docAttributes['data-theme'], 'amoled');
		assert.equal(docAttributes['data-theme-mode'], 'amoled');
		assert.equal(getCurrentTheme(), 'amoled');
		assert.equal(getResolvedTheme(), 'amoled');
	});

	it('should notify subscribers on theme change', async () => {
		const { applyTheme, onThemeChange } = await import('./theme.ts');
		const history: string[] = [];

		const unsubscribe = onThemeChange((theme, resolved) => {
			history.push(`${theme}:${resolved}`);
		});

		applyTheme('light');
		applyTheme('amoled');

		unsubscribe();
		applyTheme('dark');

		// The last 'dark' should not be in history after unsubscribe
		assert.ok(history.includes('light:light'));
		assert.ok(history.includes('amoled:amoled'));
		assert.ok(!history.includes('dark:dark') || history[history.length - 1] === 'amoled:amoled');
	});
});
