import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { calculateGrid, getGapForCellSize } from './grid-calculator.ts';

describe('grid-calculator mobile adaptations', () => {
	it('should calculate proper gap based on cell size', () => {
		assert.equal(getGapForCellSize(220), 12);
		assert.equal(getGapForCellSize(150), 8);
		assert.equal(getGapForCellSize(80), 6);
		assert.equal(getGapForCellSize(44), 4);
		assert.equal(getGapForCellSize(20), 4);
	});

	it('should enforce minimum cell size of 44px on mobile', () => {
		// Small mobile viewport with many probes (e.g. 100 probes on 375x667)
		const layout = calculateGrid({
			viewportWidth: 375,
			viewportHeight: 667,
			probeCount: 100,
			headerHeight: 48,
			incidentBarHeight: 40,
			isMobile: true
		});

		assert.ok(layout.cellSize >= 44, `Expected cellSize >= 44, got ${layout.cellSize}`);
		assert.equal(layout.overflows, true, 'Expected overflows to be true when probes exceed mobile viewport');
	});

	it('should keep 44px touch targets on mobile when the viewport can fit them', () => {
		const layout = calculateGrid({
			viewportWidth: 390,
			viewportHeight: 844,
			probeCount: 12,
			headerHeight: 48,
			incidentBarHeight: 40,
			isMobile: true
		});

		assert.ok(layout.cellSize >= 44, `Expected cellSize >= 44, got ${layout.cellSize}`);
		assert.equal(layout.overflows, false);
	});

	it('should allow cell size < 44px on desktop to maintain zero-scroll', () => {
		// Desktop resolution with 200 probes
		const layout = calculateGrid({
			viewportWidth: 1280,
			viewportHeight: 720,
			probeCount: 200,
			headerHeight: 48,
			incidentBarHeight: 40,
			isMobile: false
		});

		// On desktop, cell size can be reduced below 44px to prevent overflow
		assert.equal(layout.overflows, false, 'Expected zero scroll on desktop');
	});

	it('should maintain micro density and correct gap with >=44px cells when overflowing on mobile', () => {
		const layout = calculateGrid({
			viewportWidth: 375,
			viewportHeight: 667,
			probeCount: 100,
			headerHeight: 48,
			incidentBarHeight: 40,
			isMobile: true
		});

		assert.ok(layout.cellSize >= 44, `Expected cellSize >= 44, got ${layout.cellSize}`);
		assert.equal(layout.density, 'micro', `Expected density micro, got ${layout.density}`);
		assert.equal(layout.gap, getGapForCellSize(layout.cellSize));
		assert.equal(layout.overflows, true, 'Expected overflows true on mobile with 100 probes');
	});

	it('should adapt density to large for few probes on mobile', () => {
		const layout = calculateGrid({
			viewportWidth: 390,
			viewportHeight: 844,
			probeCount: 4,
			headerHeight: 48,
			incidentBarHeight: 40,
			isMobile: true
		});

		assert.ok(layout.cellSize >= 44, `Expected cellSize >= 44, got ${layout.cellSize}`);
		assert.equal(layout.density, 'large', `Expected density large, got ${layout.density}`);
		assert.equal(layout.overflows, false);
	});

	it('should maintain zero-scroll on 1920x1080 desktop with 200 probes', () => {
		const layout = calculateGrid({
			viewportWidth: 1920,
			viewportHeight: 1080,
			probeCount: 200,
			headerHeight: 48,
			incidentBarHeight: 40,
			isMobile: false
		});

		assert.equal(layout.overflows, false, 'Expected zero scroll on 1080p desktop with 200 probes');
		assert.ok(layout.cellSize > 0, 'Cell size must be positive');
	});

	it('should handle zero or negative probe count', () => {
		const layout = calculateGrid({
			viewportWidth: 375,
			viewportHeight: 667,
			probeCount: 0,
			isMobile: true
		});

		assert.equal(layout.columns, 1);
		assert.equal(layout.rows, 1);
		assert.equal(layout.overflows, false);
	});

	it('should support zero-scroll glued pixels mode on mobile with forceZeroScroll', () => {
		const layout = calculateGrid({
			viewportWidth: 375,
			viewportHeight: 667,
			probeCount: 100,
			headerHeight: 48,
			incidentBarHeight: 40,
			isMobile: true,
			forceZeroScroll: true
		});

		assert.equal(layout.overflows, false, 'Expected zero scroll on mobile with forceZeroScroll');
		assert.equal(layout.density, 'pixel', 'Expected pixel density for glued pixels on mobile');
		assert.ok(layout.gap <= 1, `Expected gap <= 1 for glued pixels, got ${layout.gap}`);
		assert.ok(layout.cellSize > 0, 'Cell size must be positive');
	});
});
