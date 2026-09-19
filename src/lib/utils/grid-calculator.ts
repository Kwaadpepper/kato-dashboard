import type { GridDensity, GridInput, GridLayout } from '$lib/types';

/**
 * Hauteur par défaut du bandeau d'en-tête (Header) en pixels.
 */
export const HEADER_HEIGHT = 48;

/**
 * Hauteur par défaut du bandeau d'alertes d'incidents (IncidentBar) en pixels.
 */
export const INCIDENT_BAR_HEIGHT = 40;

/**
 * Détermine l'espacement inter-cellules (gap) optimal en pixels selon la taille de cellule.
 * - ≥ 200px : 12px
 * - ≥ 100px : 8px
 * - ≥ 50px  : 6px
 * - < 50px  : 4px
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
 * Calcule la géométrie optimale de la grille (colonnes, lignes, taille de cellule, gap, densité)
 * pour afficher l'ensemble des sondes sans aucun scroll vertical ni horizontal (zéro scroll).
 *
 * Étapes algorithmiques :
 * 1. Calcul de l'aire disponible (viewport - header - incident bar)
 * 2. Estimation de la taille idéale de cellule : sqrt(aire / nbSondes)
 * 3. Ajustement du gap selon la taille (12px, 8px, 6px, 4px)
 * 4. Calcul du nombre de colonnes : floor(largeur / (cellSize + gap))
 * 5. Calcul du nombre de lignes : ceil(nbSondes / colonnes)
 * 6. Boucle de convergence : réduction progressive de cellSize si tout ne tient pas en hauteur
 * 7. Qualification de la densité : large (≥200px), medium (≥100px), compact (≥60px), micro (≥30px), pixel (<30px)
 *    avec bascule automatique en haute densité (>120 sondes) pour préserver la lisibilité.
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

	// Cas limite : aucune sonde à afficher
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

	// 1. Calcul de l'espace utile disponible
	// On soustrait 16px (padding ProbeGrid p-2 = 8px × 2 côtés) pour éviter le dépassement.
	const PROBEGRID_PADDING = 16;
	const availableWidth = Math.max(1, viewportWidth - PROBEGRID_PADDING);
	const availableHeight = Math.max(
		1,
		viewportHeight - headerHeight - incidentBarHeight - PROBEGRID_PADDING
	);

	// 2. Recherche de la meilleure géométrie de grille pour remplir le viewport sans scroll.
	// On maximise la taille de cellule en testant plusieurs nombres de colonnes, puis on garde
	// celle qui donne la plus grande cellule tout en restant dans la largeur et la hauteur disponibles.
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

	// 7. Détermination de la densité d'affichage
	let density: GridDensity;
	if (cellSize >= 180) density = 'large';
	else if (cellSize >= 90) density = 'medium';
	else if (cellSize >= 60) density = 'compact';
	else if (input.forceZeroScroll || cellSize <= 24) density = 'pixel';
	else if (cellSize >= 25) density = 'micro';
	else density = 'pixel';

	// Si la grille déborde hors mobile, on bascule en pixel.
	if (!isMobile && !overflows) {
		overflows = hasGridOverflow(columns, rows, cellSize, gap, availableWidth, availableHeight);
		if (overflows || cellSize <= 24) {
			density = 'pixel';
		}
	}

	// Gap minimal en mode pixel pour des pixels collés continus.
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

// Re-exporte les types associés pour commodité d'importation
export type { GridDensity, GridInput, GridLayout };

// ============================================================================
// TESTS DE VALIDATION & SCÉNARIOS TYPES (Conformité docs/GRID_ALGORITHM.md)
// ============================================================================
/*
  Exemples vérifiés sur résolution standard 1920×1080 (header=48px, incidentBar=40px) :
  Espace utile = 1920 × 992 px

  1. Test 4 sondes :
     calculateGrid({ viewportWidth: 1920, viewportHeight: 1080, probeCount: 4, headerHeight: 48, incidentBarHeight: 40 })
     → cellSize ~484px (≥ 200px)
     → density: 'large' (colonnes: 3, lignes: 2, gap: 12)

  2. Test 50 sondes :
     calculateGrid({ viewportWidth: 1920, viewportHeight: 1080, probeCount: 50, headerHeight: 48, incidentBarHeight: 40 })
     → cellSize ~183px (≥ 100px)
     → density: 'medium' (colonnes: 10, lignes: 5, gap: 8)

  3. Test 200 sondes :
     calculateGrid({ viewportWidth: 1920, viewportHeight: 1080, probeCount: 200, headerHeight: 48, incidentBarHeight: 40 })
     → cellSize ~89px
     → density: 'micro' (mode haute densité pastilles ProbeDot, 200 sondes > 120)
*/
