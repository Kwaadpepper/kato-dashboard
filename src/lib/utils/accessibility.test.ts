import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { calculateNextGridIndex } from './keyboard-grid.ts';
import { fr } from '../i18n/locales/fr.ts';
import { en } from '../i18n/locales/en.ts';

describe('RGAA and Keyboard Accessibility Conformance', () => {
	it('should verify app.html sets default lang to fr and syncs with localStorage', () => {
		const appHtml = readFileSync(resolve(process.cwd(), 'src/app.html'), 'utf-8');
		assert.match(appHtml, /<html\s+lang="fr"/, 'app.html must have lang="fr" default');
		assert.match(appHtml, /localStorage\.getItem\('kato-locale'\)/, 'app.html must read saved locale');
		assert.match(appHtml, /document\.documentElement\.lang\s*=\s*savedLocale/, 'app.html must sync lang attribute');
	});

	it('should verify app.css defines high-contrast focus rings and :focus-visible rules (RGAA 10.7)', () => {
		const appCss = readFileSync(resolve(process.cwd(), 'src/app.css'), 'utf-8');
		// Dark theme focus ring token
		assert.match(appCss, /--kato-focus-ring:\s*#38BDF8;/, 'Dark theme must define --kato-focus-ring');
		// Light theme focus ring token
		assert.match(appCss, /--kato-focus-ring:\s*#0284C7;/, 'Light theme must define high-contrast --kato-focus-ring');
		// Global :focus-visible rule
		assert.match(appCss, /:focus-visible\s*\{[^}]*outline:/, 'app.css must have explicit :focus-visible outline rule');
		// Skip link utility classes
		assert.match(appCss, /\.skip-link:focus-visible/, 'app.css must style skip-links on focus');
		// Marquee pause on focus-within (RGAA 13.8)
		assert.match(appCss, /\.animate-kato-marquee:focus-within/, 'Marquee must pause on focus-within');
	});

	it('should verify 2D grid arrow navigation covers all boundary conditions', () => {
		// Grid with 20 probes, 4 columns (5 rows)
		// Row 0: 0, 1, 2, 3
		// Row 1: 4, 5, 6, 7
		// Row 2: 8, 9, 10, 11
		// Row 3: 12, 13, 14, 15
		// Row 4: 16, 17, 18, 19
		assert.equal(calculateNextGridIndex(0, 20, 4, 'ArrowRight'), 1);
		assert.equal(calculateNextGridIndex(3, 20, 4, 'ArrowRight'), 4);
		assert.equal(calculateNextGridIndex(19, 20, 4, 'ArrowRight'), 19);

		assert.equal(calculateNextGridIndex(0, 20, 4, 'ArrowLeft'), 0);
		assert.equal(calculateNextGridIndex(4, 20, 4, 'ArrowLeft'), 3);

		assert.equal(calculateNextGridIndex(2, 20, 4, 'ArrowDown'), 6);
		assert.equal(calculateNextGridIndex(14, 20, 4, 'ArrowDown'), 18);
		assert.equal(calculateNextGridIndex(18, 20, 4, 'ArrowDown'), 19);

		assert.equal(calculateNextGridIndex(18, 20, 4, 'ArrowUp'), 14);
		assert.equal(calculateNextGridIndex(2, 20, 4, 'ArrowUp'), 0);

		assert.equal(calculateNextGridIndex(15, 20, 4, 'Home'), 0);
		assert.equal(calculateNextGridIndex(2, 20, 4, 'End'), 19);
	});

	it('should ensure all accessibility labels exist in French and English dictionaries', () => {
		assert.ok(fr.common.pageTitle, 'French pageTitle must exist');
		assert.ok(en.common.pageTitle, 'English pageTitle must exist');
		assert.ok(fr.header.scoreAria, 'French scoreAria must exist');
		assert.ok(en.header.scoreAria, 'English scoreAria must exist');
		assert.ok(fr.detailModal.closeAria, 'French closeAria must exist');
		assert.ok(en.detailModal.closeAria, 'English closeAria must exist');
		assert.ok(fr.login.passwordLabel, 'French passwordLabel must exist');
		assert.ok(en.login.passwordLabel, 'English passwordLabel must exist');
		assert.ok(fr.login.invalidPassword, 'French invalidPassword must exist');
		assert.ok(en.login.invalidPassword, 'English invalidPassword must exist');
	});

	it('should verify LoginForm template has aria-invalid and aria-describedby for errors', () => {
		const loginForm = readFileSync(
			resolve(process.cwd(), 'src/lib/components/LoginForm.svelte'),
			'utf-8'
		);
		assert.match(loginForm, /aria-invalid=\{hasError\}/, 'Password input must have aria-invalid');
		assert.match(
			loginForm,
			/aria-describedby=\{hasError \? 'login-error' : undefined\}/,
			'Password input must link to error message'
		);
		assert.match(loginForm, /id="login-error"/, 'Error alert must have id="login-error"');
		assert.match(loginForm, /role="alert"/, 'Error alert must have role="alert"');
	});
});
