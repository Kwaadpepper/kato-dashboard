import type { GridDensity, GridInput, GridLayout } from '$lib/types';

/**
 * Default Header bar height in pixels.
 */
export const HEADER_HEIGHT = 48;

/**
 * Default IncidentBar height in pixels.
 */
export const INCIDENT_BAR_HEIGHT = 40;

/**
 * Determines the optimal inter-cell gap in pixels based on cell size.
 * - >= 200px : 12px
 * - >= 100px : 8px
 * - >= 50px  : 6px
 * - < 50px   : 4px
 */
export function getGapForCellSize(cellSize: number): number {
	if (cellSize >= 200) return 12;
	if (cellSize >= 100) return 8;
	if (cellSize >= 50) return 6;
	return 4;
}

function hasGridOverflow(
	columns: number,
	rows: number,
	cellSize: number,
	gap: number,
	availableWidth: number,
	availableHeight: number
): boolean {
	return (
		rows * cellSize + (rows - 1) * gap > availableHeight ||
		columns * cellSize + (columns - 1) * gap > availableWidth
	);
}

function getMaxCellSize(
	columns: number,
	rows: number,
	gap: number,
	availableWidth: number,
	availableHeight: number
): number {
	const maxCellByWidth = Math.max(
		1,
		Math.floor((availableWidth - (columns - 1) * gap) / columns)
	);
	const maxCellByHeight = Math.max(
		1,
		Math.floor((availableHeight - (rows - 1) * gap) / rows)
	);

	return Math.max(1, Math.min(maxCellByWidth, maxCellByHeight));
}

function findBestGridGeometry(probeCount: number, availableWidth: number, availableHeight: number) {
	let columns = 1;
	let rows = probeCount;
	let cellSize = 1;
	let gap = 4;

	for (let candidateColumns = 1; candidateColumns <= probeCount; candidateColumns++) {
		const candidateRows = Math.ceil(probeCount / candidateColumns);
		let candidateGap = 4;
		let candidateCellSize = 1;
		for (let iter = 0; iter < 3; iter++) {
			candidateCellSize = getMaxCellSize(
				candidateColumns,
				candidateRows,
				candidateGap,
				availableWidth,
				availableHeight
			);
			const nextGap = getGapForCellSize(candidateCellSize);
			if (nextGap === candidateGap) break;
			candidateGap = nextGap;
		}

		if (candidateCellSize > cellSize) {
			columns = candidateColumns;
			rows = candidateRows;
			cellSize = candidateCellSize;
			gap = candidateGap;
		}
	}

	return { columns, rows, cellSize, gap };
}

function rebalanceColumnsToFit(
	probeCount: number,
	availableWidth: number,
	availableHeight: number,
	absoluteMinCellSize: number,
	current: { columns: number; rows: number; cellSize: number; gap: number }
) {
	let { columns, rows, cellSize, gap } = current;

	while (columns > 1 && columns * cellSize + (columns - 1) * gap > availableWidth) {
		columns--;
		rows = Math.ceil(probeCount / columns);
		cellSize = Math.max(
			absoluteMinCellSize,
			getMaxCellSize(columns, rows, gap, availableWidth, availableHeight)
		);
		gap = getGapForCellSize(cellSize);
	}

	return { columns, rows, cellSize, gap };
}

/**
 * Calculates the optimal grid geometry (columns, rows, cell size, gap, density)
 * to display all probes without vertical or horizontal scroll (zero scroll).
 *
 * Algorithm steps:
 * 1. Calculate usable available area (viewport - header - incident bar - padding)
 * 2. Search for the optimal grid geometry maximizing cell size across candidate columns
 * 3. Adapt gap based on cell size (12px, 8px, 6px, 4px)
 * 4. Check boundaries and rebalance if necessary
 * 5. Determine display density: large (>=180px), medium (>=90px), compact (>=60px), micro (>=25px), pixel (<25px)
 */
export function calculateGrid(input: GridInput): GridLayout {
	const {
		viewportWidth,
		viewportHeight,
		probeCount,
		headerHeight = 0,
		incidentBarHeight = 0,
		isMobile = false
	} = input;

	// Edge case: no probes to display
	if (probeCount <= 0) {
		return {
			density: 'large',
			columns: 1,
			rows: 1,
			cellSize: 300,
			gap: 12,
			overflows: false
		};
	}

	// 1. Calculate usable space
	// Subtract 16px (ProbeGrid p-2 padding = 8px x 2 sides) to prevent overflow
	const PROBEGRID_PADDING = 16;
	const availableWidth = Math.max(1, viewportWidth - PROBEGRID_PADDING);
	const availableHeight = Math.max(
		1,
		viewportHeight - headerHeight - incidentBarHeight - PROBEGRID_PADDING
	);

	// 2. Find best grid geometry to fill viewport without scrolling
	const absoluteMinCellSize = 2; // Allow small cells for pixel density on all devices
	let { columns, rows, cellSize, gap } = findBestGridGeometry(
		probeCount,
		availableWidth,
		availableHeight
	);

	let overflows = false;

	if (isMobile && !input.forceZeroScroll) {
		const minTouchCellSize = 44;
		if (cellSize < minTouchCellSize) {
			cellSize = minTouchCellSize;
			gap = getGapForCellSize(cellSize);
			columns = Math.max(1, Math.floor((availableWidth + gap) / (cellSize + gap)));
			rows = Math.ceil(probeCount / columns);
			overflows = rows * (cellSize + gap) > availableHeight;
		}
	} else {
		({ columns, rows, cellSize, gap } = rebalanceColumnsToFit(
			probeCount,
			availableWidth,
			availableHeight,
			absoluteMinCellSize,
			{ columns, rows, cellSize, gap }
		));
	}

	// 3. Determine display density
	let density: GridDensity;
	if (cellSize >= 180) density = 'large';
	else if (cellSize >= 90) density = 'medium';
	else if (cellSize >= 60) density = 'compact';
	else if (input.forceZeroScroll || cellSize <= 24) density = 'pixel';
	else if (cellSize >= 25) density = 'micro';
	else density = 'pixel';

	// If grid overflows outside mobile, fall back to pixel density
	if (!isMobile && !overflows) {
		overflows = hasGridOverflow(columns, rows, cellSize, gap, availableWidth, availableHeight);
		if (overflows || cellSize <= 24) {
			density = 'pixel';
		}
	}

	// Minimal gap in pixel mode for contiguous pixel look
	if (density === 'pixel') {
		gap = cellSize <= 8 ? 0 : 1;
		if (!isMobile || input.forceZeroScroll) {
			overflows = hasGridOverflow(columns, rows, cellSize, gap, availableWidth, availableHeight);
		}
	}

	return {
		density,
		columns,
		rows,
		cellSize,
		gap,
		overflows
	};
}

// Re-export associated types for convenience
export type { GridDensity, GridInput, GridLayout };
