<script lang="ts">
  import ProbeCell from "$lib/components/ProbeCell.svelte";
  import ProbeDot from "$lib/components/ProbeDot.svelte";
  import type { GridLayout, NormalizedProbe, ProbeStatus } from "$lib/types";
  import { calculateNextGridIndex } from "$lib/utils/keyboard-grid";
  import { t } from "$lib/i18n";

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

  // Active probe index for roving tabindex (only this probe has tabindex="0")
  let focusedIndex = $state(0);

  // Keep focusedIndex within bounds if probe count changes
  $effect(() => {
    if (probes.length > 0 && focusedIndex >= probes.length) {
      focusedIndex = probes.length - 1;
    }
  });

  // 2D directional arrow keyboard navigation handler (WCAG 2.1)
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

  // Dynamic CSS Grid layout computed by adaptive algorithm
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
  aria-label={t('common.probeGridAria')}
  onkeydown={handleGridKeydown}
>
  <div
    class="grid justify-center items-center content-center transition-all duration-200"
    style={gridStyle}
  >
    {#each probes as probe, index (probe.id)}
      {#if layout.density === "large" || layout.density === "medium" || layout.density === "compact"}
        <div class="w-full h-full">
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
        </div>
      {:else}
        <div class="w-full h-full flex items-center justify-center">
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
        </div>
      {/if}
    {/each}
  </div>
</div>
