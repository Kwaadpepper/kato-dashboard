import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { STATUS_COLORS } from './colors.ts';

/**
 * Calcule la luminance relative d'une couleur RVB selon la formule WCAG 2.1.
 */
function getLuminance(r: number, g: number, b: number): number {
	const a = [r, g, b].map((v) => {
		v /= 255;
		return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
	});
	return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
}

/**
 * Convertit un code hexadécimal '#RRGGBB' en composantes [r, g, b].
 */
function hexToRgb(hex: string): [number, number, number] {
	const cleaned = hex.replace('#', '');
	const num = parseInt(cleaned, 16);
	return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

/**
 * Calcule le ratio de contraste entre deux couleurs hexadécimales.
 */
function getContrastRatio(hex1: string, hex2: string): number {
	const [r1, g1, b1] = hexToRgb(hex1);
	const [r2, g2, b2] = hexToRgb(hex2);
	const l1 = getLuminance(r1, g1, b1);
	const l2 = getLuminance(r2, g2, b2);
	const lighter = Math.max(l1, l2);
	const darker = Math.min(l1, l2);
	return (lighter + 0.05) / (darker + 0.05);
}

describe('WCAG AA Contrast Verification across themes', () => {
	it('should verify STATUS_COLORS canonical hex values are defined for all statuses', () => {
		const statuses = ['up', 'down', 'degraded', 'paused', 'pending', 'maintenance'] as const;
		for (const status of statuses) {
			const config = STATUS_COLORS[status];
			assert.ok(config, `Status ${status} is missing in STATUS_COLORS`);
			assert.ok(config.hex.startsWith('#'), `Hex for ${status} must start with #`);
			assert.ok(config.label.length > 0, `Label for ${status} must not be empty`);
		}
	});

	it('should satisfy WCAG AA (>= 4.5:1) for Light theme text tokens against white background (#FFFFFF)', () => {
		const lightTokens: Record<string, string> = {
			up: '#047857',
			down: '#B91C1C',
			degraded: '#B45309',
			paused: '#475569',
			pending: '#1D4ED8',
			maintenance: '#6D28D9',
			textPrimary: '#0F172A',
			textSecondary: '#64748B'
		};

		const whiteBg = '#FFFFFF';
		for (const [name, hex] of Object.entries(lightTokens)) {
			const ratio = getContrastRatio(hex, whiteBg);
			assert.ok(
				ratio >= 4.5,
				`Expected ${name} (${hex}) on light bg to have contrast >= 4.5:1, got ${ratio.toFixed(2)}:1`
			);
		}
	});

	it('should satisfy WCAG AA (>= 4.5:1) for Dark theme text tokens against dark background (#0F172A)', () => {
		const darkTokens: Record<string, string> = {
			up: '#34D399',
			down: '#F87171',
			degraded: '#FBBF24',
			paused: '#94A3B8',
			pending: '#60A5FA',
			maintenance: '#A78BFA',
			textPrimary: '#F8FAFC',
			textSecondary: '#94A3B8'
		};

		const darkBg = '#0F172A';
		for (const [name, hex] of Object.entries(darkTokens)) {
			const ratio = getContrastRatio(hex, darkBg);
			assert.ok(
				ratio >= 4.5,
				`Expected ${name} (${hex}) on dark bg to have contrast >= 4.5:1, got ${ratio.toFixed(2)}:1`
			);
		}
	});

	it('should satisfy WCAG AA (>= 4.5:1) for AMOLED theme text tokens against black background (#000000)', () => {
		const amoledTokens: Record<string, string> = {
			up: '#34D399',
			down: '#F87171',
			degraded: '#FBBF24',
			paused: '#A1A1AA',
			pending: '#60A5FA',
			maintenance: '#A78BFA',
			textPrimary: '#F8FAFC',
			textSecondary: '#A1A1AA'
		};

		const amoledBg = '#000000';
		for (const [name, hex] of Object.entries(amoledTokens)) {
			const ratio = getContrastRatio(hex, amoledBg);
			assert.ok(
				ratio >= 4.5,
				`Expected ${name} (${hex}) on AMOLED black bg to have contrast >= 4.5:1, got ${ratio.toFixed(2)}:1`
			);
		}
	});
});
