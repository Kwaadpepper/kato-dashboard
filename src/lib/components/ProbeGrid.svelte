<script lang="ts">
  import ProbeCell from "$lib/components/ProbeCell.svelte";
  import ProbeDot from "$lib/components/ProbeDot.svelte";
  import type { GridLayout, NormalizedProbe, ProbeStatus } from "$lib/types";
  import { calculateNextGridIndex } from "$lib/utils/keyboard-grid";

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

  // Index de la sonde active pour le roving tabindex (seule cette sonde a tabindex="0")
  let focusedIndex = $state(0);

  // Maintient focusedIndex dans les limites si la liste de sondes change
  $effect(() => {
    if (probes.length > 0 && focusedIndex >= probes.length) {
      focusedIndex = probes.length - 1;
    }
  });

  // Gestionnaire de navigation 2D aux flèches dans la grille (RGAA 7.1)
  function handleGridKeydown(event: KeyboardEvent) {
    const nextIndex = calculateNextGridIndex(
      focusedIndex,
      probes.length,
      layout.columns,
      event.key
    );

    if (nextIndex !== null) {
      event.preventDefault();
      event.stopPropagation();
      focusedIndex = nextIndex;
      const targetProbe = probes[nextIndex];
      if (targetProbe) {
        const el = document.getElementById(`probe-cell-${targetProbe.id}`);
        if (el) {
          el.focus();
          el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        }
      }
    }
  }

  // Style dynamique de la grille CSS Grid calculé par l'algorithme adaptatif
  const gridStyle = $derived(
    `grid-template-columns: repeat(${layout.columns}, minmax(0, ${layout.cellSize}px)); ` +
      `grid-auto-rows: ${layout.cellSize}px; ` +
      `gap: ${layout.gap}px;`,
  );
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
  class="w-full {layout.overflows
    ? 'min-h-full pb-4'
    : 'h-full flex items-center'} flex justify-center {layout.density ===
    'pixel' || layout.density === 'micro'
    ? 'p-1'
    : 'p-2 sm:p-4'} select-none"
  style="contain: content;"
  role="region"
  aria-label="Grille de supervision des sondes"
  onkeydown={handleGridKeydown}
>
  <div
    class="grid justify-center items-center content-center transition-all duration-200"
    style={gridStyle}
  >
    {#each probes as probe, index (probe.id)}
      <div class="w-full h-full flex items-center justify-center">
        {#if layout.density === "large" || layout.density === "medium" || layout.density === "compact"}
          <ProbeCell
            {probe}
            prevStatus={previousStatuses?.[probe.id]}
            isFlashing={flashingProbeIds.has(probe.id)}
            density={layout.density}
            cellSize={layout.cellSize}
            tabIndex={index === focusedIndex ? 0 : -1}
            oncellfocus={() => {
              focusedIndex = index;
            }}
            {onselect}
          />
        {:else}
          <ProbeDot
            {probe}
            prevStatus={previousStatuses?.[probe.id]}
            isFlashing={flashingProbeIds.has(probe.id)}
            density={layout.density}
            cellSize={layout.cellSize}
            tabIndex={index === focusedIndex ? 0 : -1}
            oncellfocus={() => {
              focusedIndex = index;
            }}
            {onselect}
          />
        {/if}
      </div>
    {/each}
  </div>
</div>
