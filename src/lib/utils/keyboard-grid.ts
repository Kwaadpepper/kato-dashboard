/**
 * Utilitaire de navigation 2D au clavier pour la grille de sondes (RGAA 7.1 / 12.1)
 *
 * Gère le calcul des indices suivant/précédent en fonction des touches directionnelles :
 * - Flèche Droite / Flèche Gauche : sonde suivante / précédente (+1 / -1)
 * - Flèche Bas / Flèche Haut : saut de ligne vertical (+colonnes / -colonnes)
 * - Début (Home) : première sonde (index 0, la plus critique en tri smart)
 * - Fin (End) : dernière sonde (index total - 1)
 * - PageDown / PageUp : saut d'un bloc de 3 lignes
 */
export function calculateNextGridIndex(
	currentIndex: number,
	total: number,
	columns: number,
	key: string
): number | null {
	if (total <= 0) return null;
	const cols = Math.max(1, columns);

	switch (key) {
		case 'ArrowRight':
			return currentIndex < total - 1 ? currentIndex + 1 : currentIndex;
		case 'ArrowLeft':
			return currentIndex > 0 ? currentIndex - 1 : 0;
		case 'ArrowDown':
			if (currentIndex + cols < total) {
				return currentIndex + cols;
			}
			return total - 1;
		case 'ArrowUp':
			if (currentIndex - cols >= 0) {
				return currentIndex - cols;
			}
			return 0;
		case 'Home':
			return 0;
		case 'End':
			return total - 1;
		case 'PageDown':
			return Math.min(total - 1, currentIndex + cols * 3);
		case 'PageUp':
			return Math.max(0, currentIndex - cols * 3);
		default:
			return null;
	}
}
