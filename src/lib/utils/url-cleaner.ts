/**
 * Cleans a URL for condensed, readable display in monitoring cards.
 * Strips protocol (http://, https://) and trailing slash if redundant.
 */
export function cleanDisplayUrl(url?: string | null): string {
	if (!url) return '';
	let cleaned = url.trim();

	// Strip protocol
	cleaned = cleaned.replace(/^https?:\/\//i, '');

	// Strip trailing slash if single (e.g. domain.com/ -> domain.com)
	if (cleaned.endsWith('/') && !cleaned.slice(0, -1).includes('/')) {
		cleaned = cleaned.slice(0, -1);
	}

	return cleaned;
}
