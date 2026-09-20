<script lang="ts">
	import X from 'lucide-svelte/icons/x';
	import Keyboard from 'lucide-svelte/icons/keyboard';
	import {
		t as translate,
		getLocale,
		onLocaleChange,
		type SupportedLocale,
		type TranslationKey
	} from '$lib/i18n';
	import { onMount } from 'svelte';

	let {
		isOpen = false,
		onclose
	}: {
		isOpen: boolean;
		onclose: () => void;
	} = $props();

	let activeLocale = $state<SupportedLocale>(getLocale());
	const t = (key: TranslationKey | string, params?: Record<string, string | number>) =>
		translate(key, params, activeLocale);

	onMount(() => onLocaleChange((loc) => (activeLocale = loc)));

	let dialogElement: HTMLElement | null = $state(null);
	let closeButtonElement: HTMLButtonElement | null = $state(null);
	let previousActiveElement: HTMLElement | null = null;

	const shortcuts = $derived([
		{ keys: ['↑', '↓', '←', '→'], desc: t('keyboardHelp.navigateGrid') },
		{ keys: activeLocale === 'fr' ? ['Début', 'Fin'] : ['Home', 'End'], desc: t('keyboardHelp.jumpFirstLast') },
		{ keys: activeLocale === 'fr' ? ['Entrée', 'Espace'] : ['Enter', 'Space'], desc: t('keyboardHelp.openDetail') },
		{ keys: activeLocale === 'fr' ? ['Échap'] : ['Esc'], desc: t('keyboardHelp.closeOrExit') },
		{ keys: ['F'], desc: t('keyboardHelp.toggleFullscreen') },
		{ keys: ['M'], desc: t('keyboardHelp.toggleMute') },
		{ keys: ['T'], desc: t('keyboardHelp.cycleTheme') },
		{ keys: ['P'], desc: t('keyboardHelp.toggleMarquee') },
		{ keys: ['Tab', 'Shift + Tab'], desc: t('keyboardHelp.navigateRegions') },
		{ keys: ['?'], desc: t('keyboardHelp.toggleHelp') }
	]);

	function handleKeydown(event: KeyboardEvent) {
		if (!isOpen) return;

		if (event.key === 'Escape') {
			event.preventDefault();
			event.stopPropagation();
			onclose();
			return;
		}

		if (event.key === 'Tab' && dialogElement) {
			const focusableElements = dialogElement.querySelectorAll<HTMLElement>(
				'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
			);
			if (focusableElements.length === 0) return;

			const firstElement = focusableElements[0];
			const lastElement = focusableElements[focusableElements.length - 1];

			if (event.shiftKey) {
				if (document.activeElement === firstElement) {
					event.preventDefault();
					lastElement.focus();
				}
			} else {
				if (document.activeElement === lastElement) {
					event.preventDefault();
					firstElement.focus();
				}
			}
		}
	}

	$effect(() => {
		if (isOpen) {
			previousActiveElement = document.activeElement as HTMLElement | null;
			setTimeout(() => {
				closeButtonElement?.focus();
			}, 30);
		} else if (previousActiveElement) {
			previousActiveElement.focus();
			previousActiveElement = null;
		}
	});
</script>

<svelte:window onkeydown={handleKeydown} />

{#if isOpen}
	<!-- Background overlay -->
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 transition-opacity duration-200"
		onclick={onclose}
	>
		<!-- Modal dialog container -->
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<div
			bind:this={dialogElement}
			tabindex="-1"
			class="w-full max-w-lg bg-[var(--kato-bg-secondary)] border border-[var(--kato-border)] rounded-2xl shadow-2xl p-6 flex flex-col gap-5 text-[var(--kato-text-primary)] select-none outline-none"
			role="dialog"
			aria-modal="true"
			aria-labelledby="keyboard-help-title"
			onclick={(e) => e.stopPropagation()}
		>
			<!-- Header -->
			<div class="flex items-center justify-between pb-3 border-b border-[var(--kato-border)]">
				<div class="flex items-center gap-2.5">
					<div class="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
						<Keyboard class="w-5 h-5" aria-hidden="true" />
					</div>
					<div>
						<h2 id="keyboard-help-title" class="text-base font-bold">
							{t('keyboardHelp.title')}
						</h2>
						<p class="text-xs text-[var(--kato-text-secondary)]">
							{t('keyboardHelp.subtitle')}
						</p>
					</div>
				</div>

				<button
					bind:this={closeButtonElement}
					type="button"
					onclick={onclose}
					class="p-1.5 rounded-lg hover:bg-slate-800 text-[var(--kato-text-secondary)] hover:text-white transition-colors cursor-pointer"
					aria-label={t('keyboardHelp.closeAria')}
				>
					<X class="w-5 h-5" aria-hidden="true" />
				</button>
			</div>

			<!-- Shortcuts list -->
			<div class="space-y-2.5 max-h-[60vh] overflow-y-auto pr-1">
				{#each shortcuts as item (item.desc)}
					<div
						class="flex items-center justify-between p-2.5 rounded-lg bg-slate-950/30 border border-[var(--kato-border)] text-xs"
					>
						<span class="text-[var(--kato-text-secondary)] pr-3">
							{item.desc}
						</span>
						<div class="flex items-center gap-1 shrink-0 font-mono">
							{#each item.keys as key (key)}
								<kbd
									class="px-2 py-1 rounded bg-slate-800 border border-slate-700 text-slate-200 font-bold text-[11px] shadow-xs"
								>
									{key}
								</kbd>
							{/each}
						</div>
					</div>
				{/each}
			</div>

			<!-- Footer -->
			<div class="pt-2 border-t border-[var(--kato-border)] flex items-center justify-between text-xs text-[var(--kato-text-secondary)]">
				<span>{t('keyboardHelp.tip', { key: activeLocale === 'fr' ? 'Échap' : 'Esc' })}</span>
				<button
					type="button"
					onclick={onclose}
					class="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition-colors cursor-pointer text-xs"
				>
					{t('keyboardHelp.closeBtn')}
				</button>
			</div>
		</div>
	</div>
{/if}
