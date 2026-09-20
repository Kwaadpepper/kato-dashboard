# Adaptive Grid Layout Algorithm

This document specifies the core grid calculation engine of **Kato**. It serves as the mathematical and technical reference for the zero-scroll layout implementation.

---

## 1. Principles

The algorithm computes optimal cell dimensions so that **ALL probes fit within the viewport WITHOUT SCROLLING**.

Unlike traditional dashboards that extend indefinitely vertically and require scrollbars, Kato guarantees a continuous single-screen overview (*single-screen dashboard*). The level of detail displayed inside each cell dynamically adapts to its computed size.

---

## 2. Data Models (TypeScript)

### Input Interface

```typescript
export type GridDensity = 'large' | 'medium' | 'compact' | 'micro' | 'pixel';

export interface GridInput {
  viewportWidth: number;     // Available container width in pixels
  viewportHeight: number;    // Available height = window.innerHeight - header - incidentBar
  probeCount: number;        // Total number of active probes to render
  headerHeight?: number;     // Header height (standard ~48px or compact ~32px)
  incidentBarHeight?: number;// Incident bar height (~40px)
  isMobile?: boolean;        // Enables touch accessibility constraints (min 44px)
}
```

### Output Interface

```typescript
export interface GridLayout {
  density: GridDensity;
  columns: number;
  rows: number;
  cellSize: number;  // Dimension in pixels (side of a square cell or reference width)
  gap: number;       // Inter-cell spacing in pixels
  overflows: boolean;// Indicates whether vertical scrolling is required (mobile exception)
}
```

---

## 3. Mathematical Algorithm

The algorithm takes an iterative geometric convergence approach:

1. **Calculate Available Area**: $W_{\text{avail}} \times H_{\text{avail}}$.
2. **Estimate Initial Cell Size**: Ideal cell area = $\text{Total Area} / N$. Initial $S = \lfloor \sqrt{\text{Ideal Area}} \rfloor$.
3. **Determine Dynamic Gap**:
   - $S \ge 200\text{px} \implies \text{gap} = 12\text{px}$
   - $S \ge 100\text{px} \implies \text{gap} = 8\text{px}$
   - $S \ge 50\text{px} \implies \text{gap} = 6\text{px}$
   - Otherwise $\text{gap} = 4\text{px}$
4. **Convergence Loop**: Decrement $S$ by 2px until:
   $$\text{rows} \times (S + \text{gap}) \le H_{\text{avail}} \quad \text{or} \quad S \le S_{\min}$$
5. **Classify Density Tier**:
   - $S \ge 200\text{px} \implies \text{large}$
   - $S \ge 100\text{px} \implies \text{medium}$
   - $S \ge 60\text{px} \implies \text{compact}$
   - $S \ge 30\text{px} \implies \text{micro}$
   - Otherwise $\implies \text{pixel}$

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
  
  const availableWidth = viewportWidth;
  const availableHeight = viewportHeight;
  const totalArea = availableWidth * availableHeight;
  
  const idealCellArea = totalArea / probeCount;
  let cellSize = Math.floor(Math.sqrt(idealCellArea));
  
  let gap: number;
  if (cellSize >= 200) gap = 12;
  else if (cellSize >= 100) gap = 8;
  else if (cellSize >= 50) gap = 6;
  else gap = 4;
  
  let columns = Math.floor(availableWidth / (cellSize + gap));
  columns = Math.max(columns, 1);
  let rows = Math.ceil(probeCount / columns);
  
  const minCellSize = isMobile ? 44 : 12;
  
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
  
  const overflows = rows * (cellSize + gap) > availableHeight;
  
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

## 4. Density Tiers & Content Rendering

The UI switches component modes based on computed `density`:

| Density | Min `cellSize` | Max `cellSize` | Component | Rendered Details |
|---|---|---|---|---|
| `large` | 200px | ∞ | `<ProbeCell mode="large" />` | Full name, URL, 24h uptime %, latency (ms), sparkline |
| `medium` | 100px | 199px | `<ProbeCell mode="medium" />` | Probe name, status badge, uptime %, latency |
| `compact` | 60px | 99px | `<ProbeCell mode="compact" />` | Truncated name, status badge, latency |
| `micro` | 30px | 59px | `<ProbeDot mode="micro" />` | Circular color dot with hover tooltip |
| `pixel` | 12px | 29px | `<ProbeDot mode="pixel" />` | Compact heatmap pixel with hover tooltip |

---

## 5. Concrete Resolution Examples

On a standard **1920×1080** display with a 48px header and 40px incident bar ($\approx 1920\times 992\text{px}$ available):

| Probe Count | `cellSize` | `columns` | `rows` | Density |
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

## 6. Svelte 5 Reactive Integration

Recalculations trigger reactively using Svelte 5 Runes:
- **Window Resize**: Debounced at 150ms via `ResizeObserver` on the grid container.
- **Probe Count Changes**: Instant re-computation when probes are added, removed, or filtered.
- **Bar Toggles**: Recalculates when incident or detail panels toggle.

```svelte
<script lang="ts">
  import { calculateGrid } from '$lib/utils/grid-calculator';
  import type { NormalizedProbe } from '$lib/types';
  import ProbeCell from '$lib/components/ProbeCell.svelte';
  import ProbeDot from '$lib/components/ProbeDot.svelte';

  let { 
    probes = [], 
    headerHeight = 48, 
    incidentBarHeight = 40 
  }: { 
    probes: NormalizedProbe[];
    headerHeight?: number;
    incidentBarHeight?: number;
  } = $props();

  let viewportWidth = $state(window.innerWidth);
  let viewportHeight = $state(window.innerHeight - headerHeight - incidentBarHeight);

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
      <ProbeDot {probe} density={grid.density} cellSize={grid.cellSize} />
    {/if}
  {/each}
</div>
```

---

## 7. Mobile Considerations

- **Touch Targets**: On mobile screens (`< 768px`), cells enforce a minimum dimension of **44px** to meet Apple HIG and Google Material touch accessibility standards.
- **Controlled Vertical Scrolling**: When probe count exceeds what can fit in the viewport at 44px, vertical scrolling is permitted (`overflow-y-auto`).
- **Centering**: When the last row is partially filled, cells remain visually centered in the view.
