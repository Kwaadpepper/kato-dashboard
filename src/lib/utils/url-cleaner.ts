/**
 * Nettoie une URL pour un affichage condensé et lisible dans les cartes de monitoring.
 * Retire le protocole (http://, https://) et le slash de fin si inutile.
 */
export function cleanDisplayUrl(url?: string | null): string {
	if (!url) return '';
	let cleaned = url.trim();

	// Supprime le protocole
	cleaned = cleaned.replace(/^https?:\/\//i, '');

	// Supprime le slash final s'il est unique (ex: domain.com/ -> domain.com)
	if (cleaned.endsWith('/') && !cleaned.slice(0, -1).includes('/')) {
		cleaned = cleaned.slice(0, -1);
	}

	return cleaned;
}
