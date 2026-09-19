import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { cleanDisplayUrl } from './url-cleaner.ts';

describe('url-cleaner utility', () => {
	it('should return empty string for null or undefined or empty', () => {
		assert.equal(cleanDisplayUrl(null), '');
		assert.equal(cleanDisplayUrl(undefined), '');
		assert.equal(cleanDisplayUrl(''), '');
	});

	it('should strip http:// and https:// protocols', () => {
		assert.equal(cleanDisplayUrl('https://edge-lon.kato-cdn.net'), 'edge-lon.kato-cdn.net');
		assert.equal(cleanDisplayUrl('http://api.internal/health'), 'api.internal/health');
	});

	it('should remove trailing slash if no other path components', () => {
		assert.equal(cleanDisplayUrl('https://my-app.io/'), 'my-app.io');
		assert.equal(cleanDisplayUrl('https://my-app.io/sub/'), 'my-app.io/sub/');
	});
});
