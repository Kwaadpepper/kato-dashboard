export type ProbeDotDensity = 'micro' | 'pixel';

export function getProbeDotSize(density: ProbeDotDensity, cellSize: number): number {
	const safeCellSize = Math.max(1, cellSize);

	if (density === 'pixel') {
		return safeCellSize;
	}

	const size = Math.max(6, Math.floor(safeCellSize * 0.7));
	return Math.min(size, 18);
}
