import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calculateNextGridIndex } from './keyboard-grid.ts';

describe('keyboard-grid utility module', () => {
	it('should return null for non-navigation keys', () => {
		assert.equal(calculateNextGridIndex(0, 10, 3, 'a'), null);
		assert.equal(calculateNextGridIndex(0, 10, 3, 'Enter'), null);
		assert.equal(calculateNextGridIndex(0, 10, 3, 'Escape'), null);
	});

	it('should navigate horizontally with ArrowRight and ArrowLeft', () => {
		// total 10, columns 4
		assert.equal(calculateNextGridIndex(0, 10, 4, 'ArrowRight'), 1);
		assert.equal(calculateNextGridIndex(1, 10, 4, 'ArrowRight'), 2);
		assert.equal(calculateNextGridIndex(9, 10, 4, 'ArrowRight'), 9); // clamp at end

		assert.equal(calculateNextGridIndex(2, 10, 4, 'ArrowLeft'), 1);
		assert.equal(calculateNextGridIndex(1, 10, 4, 'ArrowLeft'), 0);
		assert.equal(calculateNextGridIndex(0, 10, 4, 'ArrowLeft'), 0); // clamp at start
	});

	it('should navigate vertically with ArrowDown and ArrowUp according to column count', () => {
		// 10 items in a 3-column grid (rows: [0,1,2], [3,4,5], [6,7,8], [9])
		assert.equal(calculateNextGridIndex(0, 10, 3, 'ArrowDown'), 3);
		assert.equal(calculateNextGridIndex(3, 10, 3, 'ArrowDown'), 6);
		assert.equal(calculateNextGridIndex(6, 10, 3, 'ArrowDown'), 9);
		assert.equal(calculateNextGridIndex(8, 10, 3, 'ArrowDown'), 9); // goes to last item if overflow
		assert.equal(calculateNextGridIndex(9, 10, 3, 'ArrowDown'), 9);

		assert.equal(calculateNextGridIndex(9, 10, 3, 'ArrowUp'), 6);
		assert.equal(calculateNextGridIndex(6, 10, 3, 'ArrowUp'), 3);
		assert.equal(calculateNextGridIndex(3, 10, 3, 'ArrowUp'), 0);
		assert.equal(calculateNextGridIndex(1, 10, 3, 'ArrowUp'), 0);
		assert.equal(calculateNextGridIndex(0, 10, 3, 'ArrowUp'), 0);
	});

	it('should jump to start with Home and end with End', () => {
		assert.equal(calculateNextGridIndex(5, 20, 5, 'Home'), 0);
		assert.equal(calculateNextGridIndex(5, 20, 5, 'End'), 19);
	});

	it('should page jump with PageDown and PageUp', () => {
		// 30 items, 5 columns: 3 lines = 15 items jump
		assert.equal(calculateNextGridIndex(2, 30, 5, 'PageDown'), 17);
		assert.equal(calculateNextGridIndex(25, 30, 5, 'PageDown'), 29); // clamp to end
		assert.equal(calculateNextGridIndex(20, 30, 5, 'PageUp'), 5);
		assert.equal(calculateNextGridIndex(5, 30, 5, 'PageUp'), 0); // clamp to start
	});
});
