# Algorithme de Grille Adaptative

Ce document décrit l'algorithme central de calcul de grille de **Kato**. Il sert de référence technique pour l'implémentation du moteur d'affichage réactif.

## Principe

L'algorithme calcule automatiquement la taille optimale des cellules pour que **TOUTES les sondes tiennent dans le viewport SANS SCROLL**. 

Contrairement aux tableaux de bord conventionnels qui s'étendent verticalement à l'infini en générant une barre de défilement, Kato garantit une vue d'ensemble instantanée (*single-screen dashboard*). La densité d'information affichée au sein de chaque sonde s'adapte dynamiquement à la taille calculée de sa cellule.

---

## Modèles de Données (TypeScript)

### Types et Entrées

```typescript
export type GridDensity = 'large' | 'medium' | 'compact' | 'micro' | 'pixel';

export interface GridInput {
  viewportWidth: number;     // Largeur du conteneur en pixels (hors scrollbar / marges globales)
  viewportHeight: number;    // Hauteur disponible = window.innerHeight - headerHeight - incidentBarHeight
  probeCount: number;        // Nombre total de sondes actives à afficher
  headerHeight?: number;     // Hauteur du header (ex. 48px standard ou 32px compact)
  incidentBarHeight?: number;// Hauteur du bandeau d'incidents (ex. 40px)
  isMobile?: boolean;        // Active la contrainte d'accessibilité tactile (min 44px)
}
```

### Sortie

```typescript
export interface GridLayout {
  density: GridDensity;
  columns: number;
  rows: number;
  cellSize: number;  // Taille en px (côté d'une cellule carrée / largeur de référence)
  gap: number;       // Espacement inter-cellules en px
  overflows: boolean;// Indique si un défilement vertical est nécessaire (ex. mode mobile contraint)
}
```

---

## Algorithme

L'algorithme adopte une approche géométrique optimisée :
1. Calcul de la surface disponible totale ($L \times H$).
2. Estimation de la surface théorique maximale par sonde ($\text{Surface Totale} / N$) et extraction de la racine carrée comme première approximation de `cellSize`.
3. Ajustement progressif (boucle de convergence) en tenant compte des marges (`gap`) et du ratio d'aspect pour garantir que le nombre requis de colonnes et lignes tient strictement dans `availableHeight`.
4. Qualification de la densité d'affichage finale.

```typescript
export function calculateGrid(input: GridInput): GridLayout {
  const { 
    viewportWidth, 
    viewportHeight, 
    probeCount, 
    isMobile = false 
  } = input;
  
  if (probeCount === 0) {
    return { 
      density: 'large', 
      columns: 1, 
      rows: 1, 
      cellSize: 300, 
      gap: 12,
      overflows: false
    };
  }
  
  // Espace disponible
  const availableWidth = viewportWidth;
  const availableHeight = viewportHeight;
  const totalArea = availableWidth * availableHeight;
  
  // Taille idéale de cellule (racine carrée de l'aire divisée par le nombre)
  const idealCellArea = totalArea / probeCount;
  let cellSize = Math.floor(Math.sqrt(idealCellArea));
  
  // Déterminer le gap selon la taille
  let gap: number;
  if (cellSize >= 200) gap = 12;
  else if (cellSize >= 100) gap = 8;
  else if (cellSize >= 50) gap = 6;
  else gap = 4;
  
  // Calculer colonnes et lignes avec le gap
  let columns = Math.floor(availableWidth / (cellSize + gap));
  columns = Math.max(columns, 1);
  let rows = Math.ceil(probeCount / columns);
  
  // Seuil minimal absolu de taille de cellule
  const minCellSize = isMobile ? 44 : 12;
  
  // Vérifier que tout tient en hauteur, sinon réduire la cellSize
  while (rows * (cellSize + gap) > availableHeight && cellSize > minCellSize) {
    cellSize -= 2;
    if (cellSize >= 200) gap = 12;
    else if (cellSize >= 100) gap = 8;
    else if (cellSize >= 50) gap = 6;
    else gap = 4;

    columns = Math.floor(availableWidth / (cellSize + gap));
    columns = Math.max(columns, 1);
    rows = Math.ceil(probeCount / columns);
  }
  
  // Si en mode mobile contraint la grille dépasse encore, autoriser l'overflow
  const overflows = rows * (cellSize + gap) > availableHeight;
  
  // Déterminer la densité
  let density: GridDensity;
  if (cellSize >= 200) density = 'large';
  else if (cellSize >= 100) density = 'medium';
  else if (cellSize >= 60) density = 'compact';
  else if (cellSize >= 30) density = 'micro';
  else density = 'pixel';
  
  return { density, columns, rows, cellSize, gap, overflows };
}
```

---

## Seuils de Densité et Contenu Affiché

Le composant bascule entre différents modes de rendu selon la valeur calculée de `density` :

| Densité | `cellSize` min | `cellSize` max | Composant | Contenu affiché | Classes Tailwind types |
|---|---|---|---|---|---|
| `large` | 200px | ∞ | `<ProbeCell mode="large" />` | Nom complet, URL, uptime %, latence (ms), sparkline d'historique | `p-4 rounded-xl flex flex-col justify-between shadow-sm border border-border bg-card` |
| `medium` | 100px | 199px | `<ProbeCell mode="medium" />` | Nom de la sonde, pastille d'état, uptime %, latence | `p-2.5 rounded-lg flex flex-col justify-between border border-border bg-card` |
| `compact` | 60px | 99px | `<ProbeCell mode="compact" />` | Nom tronqué, badge statut, bande de couleur d'état | `p-1.5 rounded-md flex items-center justify-between text-xs border border-border/60 bg-card` |
| `micro` | 30px | 59px | `<ProbeDot mode="micro" />` | Cercle coloré (statut), tooltip interactif au hover | `rounded-full flex items-center justify-center cursor-pointer transition-transform hover:scale-125` |
| `pixel` | 12px | 29px | `<ProbeDot mode="pixel" />` | Point coloré minimal (statut), tooltip interactif au hover | `rounded-sm flex items-center justify-center cursor-pointer hover:ring-2` |

---

## Exemples Concrets de Résolution

Sur un écran standard **1920×1080** avec header à 48px et barre d'incidents à 40px → **espace disponible 1920×992 px** :

| Nb sondes | `cellSize` | `columns` | `rows` | Densité |
|---|---|---|---|---|
| 4 | ~400px | 4 | 1 | `large` |
| 12 | ~250px | 7 | 2 | `large` |
| 24 | ~170px | 10 | 3 | `medium` |
| 50 | ~120px | 14 | 4 | `medium` |
| 80 | ~95px | 18 | 5 | `compact` |
| 120 | ~75px | 23 | 6 | `compact` |
| 200 | ~55px | 31 | 7 | `micro` |
| 300 | ~44px | 38 | 8 | `micro` |
| 500 | ~33px | 50 | 10 | `micro` |

---

## Recalcul et Intégration Svelte 5

### Déclencheurs de Recalcul
- **Redimensionnement de l'affichage (`resize`)** : recalcul debouncé à **150ms** sur l'événement `resize` de la fenêtre ou via un `ResizeObserver` attaché au conteneur principal.
- **Changement du nombre de sondes** : recalcul réactif instantané lorsque des sondes sont ajoutées, supprimées ou filtrées.
- **Visibilité des bandeaux contextuels** : recalcul lors de l'ouverture/fermeture de l'incident bar ou d'un tiroir latéral.

### Exemple de Réactivité avec Runes Svelte 5

```svelte
<script lang="ts">
  import { calculateGrid } from '$lib/utils/grid';
  import type { Probe } from '$lib/types';
  import ProbeCell from '$lib/components/ProbeCell.svelte';
  import ProbeDot from '$lib/components/ProbeDot.svelte';

  let { 
    probes = [], 
    headerHeight = 48, 
    incidentBarHeight = 40 
  }: { 
    probes: Probe[];
    headerHeight?: number;
    incidentBarHeight?: number;
  } = $props();

  let viewportWidth = $state(window.innerWidth);
  let viewportHeight = $state(window.innerHeight - headerHeight - incidentBarHeight);

  // Recalcul automatique et réactif via $derived
  const grid = $derived(
    calculateGrid({
      viewportWidth,
      viewportHeight,
      probeCount: probes.length
    })
  );
</script>

<div
  class="grid w-full h-full justify-center items-center content-center transition-all duration-200"
  style="
    grid-template-columns: repeat({grid.columns}, minmax(0, {grid.cellSize}px));
    grid-auto-rows: {grid.cellSize}px;
    gap: {grid.gap}px;
  "
>
  {#each probes as probe (probe.id)}
    {#if grid.density === 'large' || grid.density === 'medium' || grid.density === 'compact'}
      <ProbeCell {probe} mode={grid.density} size={grid.cellSize} />
    {:else}
      <ProbeDot {probe} mode={grid.density} size={grid.cellSize} />
    {/if}
  {/each}
</div>
```

---

## Mobile et Cas Particuliers

- **Accessibilité tactile (Mobile)** : Sur mobile, l'algorithme calcule normalement mais impose une taille minimale de cellule de **44px** (conformité aux guidelines Apple et Google pour les cibles tactiles).
- **Défilement vertical (Exception Mobile)** : Si le nombre de sondes empêche de faire tenir l'ensemble des cellules de 44px dans le viewport mobile, le scroll vertical est exceptionnellement autorisé (`overflow-y-auto` activé sur le conteneur principal).
- **Centrage de la grille** : Lorsque le nombre de sondes ne remplit pas intégralement la dernière ligne, la grille s'aligne au centre de la zone d'affichage (`justify-center items-center content-center`).
