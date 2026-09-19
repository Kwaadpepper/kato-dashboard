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
	const availableWidth = Math.max(1, viewportWidth);
	const availableHeight = Math.max(1, viewportHeight - headerHeight - incidentBarHeight);
	const totalArea = availableWidth * availableHeight;

	// 2. Calcul de la taille idéale théorique de cellule
	const idealCellArea = totalArea / probeCount;
	let cellSize = Math.floor(Math.sqrt(idealCellArea));

	// 3. Détermination du gap initial selon la taille
	let gap = getGapForCellSize(cellSize);

	// 4 & 5. Calcul initial des colonnes et des lignes
	let columns = Math.max(1, Math.floor(availableWidth / (cellSize + gap)));
	let rows = Math.ceil(probeCount / columns);

	// Seuil minimal absolu (44px tactile sur mobile, 12px absolu desktop)
	const minCellSize = isMobile ? 44 : 12;

	// 6. Boucle de réduction : réduit cellSize si la hauteur requise dépasse l'espace disponible
	while (rows * (cellSize + gap) > availableHeight && cellSize > minCellSize) {
		cellSize -= 2;
		gap = getGapForCellSize(cellSize);
		columns = Math.max(1, Math.floor(availableWidth / (cellSize + gap)));
		rows = Math.ceil(probeCount / columns);
	}

	// Détection d'un dépassement exceptionnel (mode mobile contraint par la cible 44px)
	const overflows = rows * (cellSize + gap) > availableHeight;

	// 7. Détermination de la densité d'affichage
	let density: GridDensity;
	if (cellSize >= 200) density = 'large';
	else if (cellSize >= 100) density = 'medium';
	else if (cellSize >= 60) density = 'compact';
	else if (cellSize >= 30) density = 'micro';
	else density = 'pixel';

	// Ajustement pour haute densité (> 120 sondes selon DATA_MODEL.md) :
	// Au-delà de 120 sondes, le dashboard bascule sur les micro-pastilles (mode micro ou pixel)
	// pour éviter la surcharge cognitive des cartes textuelles ProbeCell.
	if (probeCount > 300) {
		density = 'pixel';
	} else if (probeCount > 120 && (density === 'compact' || density === 'medium' || density === 'large')) {
		density = 'micro';
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
export type { GridInput, GridLayout, GridDensity };

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
