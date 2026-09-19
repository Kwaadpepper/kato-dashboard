<script lang="ts">
  import ProbeCell from "$lib/components/ProbeCell.svelte";
  import ProbeDot from "$lib/components/ProbeDot.svelte";
  import type { GridLayout, NormalizedProbe, ProbeStatus } from "$lib/types";

  let {
    probes = [],
    layout,
    previousStatuses,
    flashingProbeIds = new Set<string>(),
    onselect,
  }: {
    probes: NormalizedProbe[];
    layout: GridLayout;
    previousStatuses?: Record<string, ProbeStatus>;
    flashingProbeIds?: Set<string>;
    onselect?: (probe: NormalizedProbe) => void;
  } = $props();

  // Style dynamique de la grille CSS Grid calculé par l'algorithme adaptatif
  const gridStyle = $derived(
    `grid-template-columns: repeat(${layout.columns}, minmax(0, ${layout.cellSize}px)); ` +
      `grid-auto-rows: ${layout.cellSize}px; ` +
      `gap: ${layout.gap}px;`,
  );
</script>

<div
  class="w-full {layout.overflows
    ? 'min-h-full pb-4'
    : 'h-full flex items-center'} flex justify-center {layout.density ===
    'pixel' || layout.density === 'micro'
    ? 'p-1'
    : 'p-2 sm:p-4'} select-none"
  style="contain: content;"
>
  <div
    class="grid justify-center items-center content-center transition-all duration-200"
    style={gridStyle}
  >
    {#each probes as probe (probe.id)}
      <div class="w-full h-full flex items-center justify-center">
        {#if layout.density === "large" || layout.density === "medium" || layout.density === "compact"}
          <ProbeCell
            {probe}
            prevStatus={previousStatuses?.[probe.id]}
            isFlashing={flashingProbeIds.has(probe.id)}
            density={layout.density}
            cellSize={layout.cellSize}
            {onselect}
          />
        {:else}
          <ProbeDot
            {probe}
            prevStatus={previousStatuses?.[probe.id]}
            isFlashing={flashingProbeIds.has(probe.id)}
            density={layout.density}
            cellSize={layout.cellSize}
            {onselect}
          />
        {/if}
      </div>
    {/each}
  </div>
</div>
