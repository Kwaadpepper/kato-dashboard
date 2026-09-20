/**
 * 2D keyboard navigation utility for the probe grid (WCAG / accessibility).
 *
 * Computes next/previous indices based on directional keys:
 * - ArrowRight / ArrowLeft: next / previous probe (+1 / -1)
 * - ArrowDown / ArrowUp: vertical row jump (+columns / -columns)
 * - Home: first probe (index 0, most critical under smart sort)
 * - End: last probe (total index - 1)
 * - PageDown / PageUp: jump 3 rows
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
