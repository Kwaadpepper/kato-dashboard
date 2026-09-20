<script lang="ts">
  import type { NormalizedProbe, ProbeStatus } from "$lib/types";
  import { STATUS_COLORS, getStatusLabel } from "$lib/utils/colors";
  import { getProbeDotSize } from "$lib/utils/probe-dot";
  import {
    t as translate,
    getLocale,
    onLocaleChange,
    type SupportedLocale,
    type TranslationKey
  } from "$lib/i18n";
  import { onMount } from "svelte";

  let {
    probe,
    prevStatus,
    isFlashing = false,
    density = "micro",
    cellSize = 32,
    onselect,
  }: {
    probe: NormalizedProbe;
    prevStatus?: ProbeStatus;
    isFlashing?: boolean;
    density: "micro" | "pixel";
    cellSize?: number;
    onselect?: (probe: NormalizedProbe) => void;
  } = $props();

  let activeLocale = $state<SupportedLocale>(getLocale());
  const t = (key: TranslationKey | string, params?: Record<string, string | number>) =>
    translate(key, params, activeLocale);

  onMount(() => onLocaleChange((loc) => activeLocale = loc));

  const color = $derived(STATUS_COLORS[probe.status] ?? STATUS_COLORS.up);
  const statusLabel = $derived(getStatusLabel(probe.status, activeLocale));
  const isDown = $derived(probe.status === "down");
  const isDownOver1Min = $derived.by(() => {
    if (!isDown) return false;
    if (probe.downSince) {
      return Date.now() - new Date(probe.downSince).getTime() > 60_000;
    }
    return false;
  });

  // Détection des transitions d'état UP → DOWN (flashing sans $effect)
  const shouldFlash = $derived(isFlashing || (prevStatus === "up" && probe.status === "down"));

  // Dimensions adaptées à cellSize :
  // - pixel : pseudo-pixel carré avec marge minimale, pour éviter les ronds trop larges
  // - micro : plus petit mais reste lisible
  	const dotStyle = $derived.by(() => {
		if (density === 'pixel') {
			return 'width: 100%; height: 100%;';
		}
		const size = getProbeDotSize(density, cellSize);
		return `width: ${size}px; height: ${size}px;`;
	});

	const tooltipText = $derived(
		`${probe.name} — ${probe.status.toUpperCase()}${
			probe.responseTime !== null ? ` (${probe.responseTime}ms)` : ''
		}${probe.uptime24h !== null ? ` • 24h: ${probe.uptime24h}%` : ''}`
	);

	function triggerSelect(target: EventTarget | null) {
		const customEvent = new CustomEvent('probe-detail', {
			detail: probe,
			bubbles: true,
			composed: true
		});
		if (target && 'dispatchEvent' in target) {
			(target as HTMLElement).dispatchEvent(customEvent);
		}
		onselect?.(probe);
	}

	function handleClick(e: MouseEvent) {
		triggerSelect(e.currentTarget);
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			triggerSelect(e.currentTarget);
		}
	}
</script>

<div
	class="relative group flex items-center justify-center w-full h-full select-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-emerald-400 {density === 'pixel' ? 'rounded-none' : 'rounded-sm'}"
	title={tooltipText}
	role="button"
	tabindex="0"
	onclick={handleClick}
	onkeydown={handleKeydown}
	aria-label={t('probe.dotAria', {
		name: probe.name,
		status: statusLabel,
		latency: probe.responseTime !== null ? `${probe.responseTime}ms` : '—',
		uptime: probe.uptime24h !== null ? `${probe.uptime24h}%` : '—'
	})}
>
	<div
		style={dotStyle}
		class="{density === 'pixel'
			? 'w-full h-full rounded-none sm:rounded-[0.5px] group-hover:scale-110 group-hover:z-10 group-hover:ring-1 group-hover:ring-white/60'
			: 'rounded-full'} {color.bgClass} probe-dot probe-dot-{probe.status} group-hover:scale-125 transition-transform duration-150 shadow-xs {isDown
			? 'animate-kato-pulse'
			: ''} {isDownOver1Min ? 'kato-glow-red' : ''} {shouldFlash ? 'animate-kato-border-flash' : ''}"
		aria-hidden="true"
	></div>

  <!-- Tooltip contextuel au survol -->
  <div
    class="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:flex flex-col items-center z-50 pointer-events-none"
  >
    <div
      class="bg-slate-900 text-white text-[11px] rounded py-1 px-2.5 shadow-2xl border border-slate-700 whitespace-nowrap font-mono"
    >
      <p class="font-bold text-slate-100 truncate max-w-50">{probe.name}</p>
      <p class={color.textClass}>
        {probe.status.toUpperCase()}{probe.responseTime !== null
          ? ` — ${probe.responseTime}ms`
          : ""}
      </p>
      {#if probe.uptime24h !== null}
        <p class="text-slate-400 text-[10px]">{t('probe.uptime24h')}: {probe.uptime24h}%</p>
      {/if}
    </div>
    <div
      class="w-1.5 h-1.5 bg-slate-900 border-r border-b border-slate-700 rotate-45 -mt-1"
    ></div>
  </div>
</div>
