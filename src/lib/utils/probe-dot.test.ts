import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getProbeDotSize } from './probe-dot.ts';

describe('probe dot sizing', () => {
	it('fills the pixel cell and keeps micro dots smaller than their container', () => {
		assert.equal(getProbeDotSize('pixel', 12), 12);
		assert.equal(getProbeDotSize('pixel', 20), 20);
		assert.equal(getProbeDotSize('micro', 18), 12);
		assert.equal(getProbeDotSize('micro', 8), 6);
	});
});
