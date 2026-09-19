import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
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

		// Must never be smaller than 44px
		assert.ok(layout.cellSize >= 44, `Expected cellSize >= 44, got ${layout.cellSize}`);
		assert.equal(layout.overflows, true, 'Expected overflows to be true when probes exceed mobile viewport');
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
});
