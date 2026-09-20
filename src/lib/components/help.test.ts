import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { marked } from 'marked';

describe('Help Markdown Documentation', () => {
	const frPath = resolve('src/lib/assets/help/help.fr.md');
	const enPath = resolve('src/lib/assets/help/help.en.md');

	const frContent = readFileSync(frPath, 'utf-8');
	const enContent = readFileSync(enPath, 'utf-8');

	it('should load non-empty markdown help files for French and English', () => {
		assert.ok(frContent.length > 200, 'French help markdown content must not be empty');
		assert.ok(enContent.length > 200, 'English help markdown content must not be empty');
	});

	it('should contain expected shortcut tables and headings', () => {
		// Verify presence of keyboard shortcuts in both files
		assert.match(frContent, /Raccourcis Clavier/i);
		assert.match(frContent, /\| Raccourci\s+\| Action\s+\| Description\s+\|/);
		assert.match(frContent, /`↑` `↓` `←` `→`/);
		assert.match(frContent, /`F`/);
		assert.match(frContent, /`M`/);
		assert.match(frContent, /`T`/);
		assert.match(frContent, /`\?`/);

		assert.match(enContent, /Keyboard Shortcuts/i);
		assert.match(enContent, /\| Shortcut\s+\| Action\s+\| Description\s+\|/);
		assert.match(enContent, /`↑` `↓` `←` `→`/);
		assert.match(enContent, /`F`/);
		assert.match(enContent, /`M`/);
		assert.match(enContent, /`T`/);
		assert.match(enContent, /`\?`/);
	});

	it('should document statuses and TV mode in both locales', () => {
		assert.match(frContent, /UP/);
		assert.match(frContent, /DOWN/);
		assert.match(frContent, /DEGRADED/);
		assert.match(frContent, /Mode TV/i);

		assert.match(enContent, /UP/);
		assert.match(enContent, /DOWN/);
		assert.match(enContent, /DEGRADED/);
		assert.match(enContent, /TV Mode/i);
	});

	it('should parse cleanly into HTML with tables and codes using marked', () => {
		const parsedFr = marked.parse(frContent, { async: false }) as string;
		const parsedEn = marked.parse(enContent, { async: false }) as string;

		assert.ok(parsedFr.includes('<table'), 'Parsed French HTML must include <table>');
		assert.ok(parsedFr.includes('<code>↑</code>'), 'Parsed French HTML must include <code> tags');
		assert.ok(parsedEn.includes('<table'), 'Parsed English HTML must include <table>');
		assert.ok(parsedEn.includes('<code>↑</code>'), 'Parsed English HTML must include <code> tags');
	});
});
