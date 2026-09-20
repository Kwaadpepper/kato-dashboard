<script lang="ts">
	import { onMount } from 'svelte';
	import { marked } from 'marked';
	import X from 'lucide-svelte/icons/x';
	import CircleHelp from 'lucide-svelte/icons/circle-help';
	import helpFr from '$lib/assets/help/help.fr.md?raw';
	import helpEn from '$lib/assets/help/help.en.md?raw';
	import {
		t as translate,
		getLocale,
		onLocaleChange,
		type SupportedLocale,
		type TranslationKey
	} from '$lib/i18n';

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

	// Subscribe to global locale updates
	onMount(() => onLocaleChange((loc) => (activeLocale = loc)));

	let dialogElement: HTMLElement | null = $state(null);
	let closeButtonElement: HTMLButtonElement | null = $state(null);
	let previousActiveElement: HTMLElement | null = null;

	// Resolve active localized markdown raw text
	const rawMarkdown = $derived(activeLocale === 'fr' ? helpFr : helpEn);

	// Parse markdown into HTML string synchronously
	const parsedHtml = $derived(marked.parse(rawMarkdown, { async: false }) as string);

	// Handle Escape dismissal and accessible Tab/Shift+Tab focus cycling
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

			const first = focusableElements[0];
			const last = focusableElements[focusableElements.length - 1];

			if (event.shiftKey && document.activeElement === first) {
				event.preventDefault();
				last.focus();
			} else if (!event.shiftKey && document.activeElement === last) {
				event.preventDefault();
				first.focus();
			}
		}
	}

	// Capture and restore focus when the modal opens and closes
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
	<!-- Backdrop overlay with light dismiss on outside click -->
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 transition-opacity duration-200"
		onclick={onclose}
	>
		<!-- Modal dialog container -->
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<div
			bind:this={dialogElement}
			tabindex="-1"
			class="w-full max-w-2xl max-h-[85vh] bg-[var(--kato-bg-secondary)] border border-[var(--kato-border)] rounded-2xl shadow-2xl p-5 sm:p-6 flex flex-col gap-4 text-[var(--kato-text-primary)] outline-none"
			role="dialog"
			aria-modal="true"
			aria-labelledby="help-modal-title"
			onclick={(e) => e.stopPropagation()}
		>
			<!-- Modal header -->
			<div class="flex items-center justify-between pb-3 border-b border-[var(--kato-border)] shrink-0">
				<div class="flex items-center gap-3">
					<div class="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
						<CircleHelp class="w-5 h-5" aria-hidden="true" />
					</div>
					<div>
						<h2 id="help-modal-title" class="text-base font-bold text-white">
							{t('helpModal.title')}
						</h2>
						<p class="text-xs text-[var(--kato-text-secondary)]">
							{t('helpModal.subtitle')}
						</p>
					</div>
				</div>

				<button
					bind:this={closeButtonElement}
					type="button"
					onclick={onclose}
					class="p-1.5 rounded-lg hover:bg-slate-800 text-[var(--kato-text-secondary)] hover:text-white transition-colors cursor-pointer"
					aria-label={t('helpModal.closeAria')}
				>
					<X class="w-5 h-5" aria-hidden="true" />
				</button>
			</div>

			<!-- Scrollable markdown content area -->
			<div class="help-markdown-content overflow-y-auto pr-2 flex-1 text-xs leading-relaxed text-slate-300">
				<!-- eslint-disable-next-line svelte/no-at-html-tags -->
				{@html parsedHtml}
			</div>

			<!-- Modal footer -->
			<div class="pt-3 border-t border-[var(--kato-border)] flex items-center justify-between text-xs text-[var(--kato-text-secondary)] shrink-0">
				<span>{t('helpModal.tip', { key: activeLocale === 'fr' ? 'Échap' : 'Esc' })}</span>
				<button
					type="button"
					onclick={onclose}
					class="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition-colors cursor-pointer text-xs shadow-xs"
				>
					{t('helpModal.closeBtn')}
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	/* Scoped markdown content styles conforming to Kato dashboard design system */
	.help-markdown-content :global(h1) {
		font-size: 1.15rem;
		font-weight: 700;
		color: var(--kato-text-primary);
		margin-bottom: 0.5rem;
	}

	.help-markdown-content :global(h2) {
		font-size: 0.95rem;
		font-weight: 600;
		color: #34d399;
		margin-top: 1.25rem;
		margin-bottom: 0.5rem;
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.help-markdown-content :global(p) {
		margin-bottom: 0.75rem;
		color: var(--kato-text-secondary);
	}

	.help-markdown-content :global(strong) {
		color: var(--kato-text-primary);
		font-weight: 600;
	}

	.help-markdown-content :global(hr) {
		border-color: var(--kato-border);
		margin: 1rem 0;
	}

	.help-markdown-content :global(table) {
		width: 100%;
		border-collapse: collapse;
		margin: 0.75rem 0;
		border-radius: 0.5rem;
		overflow: hidden;
		border: 1px solid var(--kato-border);
		background-color: rgba(15, 23, 42, 0.4);
	}

	.help-markdown-content :global(th) {
		background-color: rgba(30, 41, 59, 0.7);
		color: var(--kato-text-primary);
		font-weight: 600;
		text-align: left;
		padding: 0.5rem 0.75rem;
		border-bottom: 1px solid var(--kato-border);
		font-size: 0.75rem;
	}

	.help-markdown-content :global(td) {
		padding: 0.45rem 0.75rem;
		border-bottom: 1px solid rgba(51, 65, 85, 0.4);
		font-size: 0.75rem;
		color: var(--kato-text-secondary);
	}

	.help-markdown-content :global(tr:last-child td) {
		border-bottom: none;
	}

	.help-markdown-content :global(code) {
		background-color: #1e293b;
		border: 1px solid #334155;
		color: #6ee7b7;
		font-family: monospace;
		font-weight: 600;
		font-size: 0.7rem;
		padding: 0.15rem 0.35rem;
		border-radius: 0.25rem;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
	}

	.help-markdown-content :global(ul) {
		list-style-type: disc;
		padding-left: 1.25rem;
		margin-bottom: 0.75rem;
	}

	.help-markdown-content :global(ol) {
		list-style-type: decimal;
		padding-left: 1.25rem;
		margin-bottom: 0.75rem;
	}

	.help-markdown-content :global(li) {
		margin-bottom: 0.35rem;
		color: var(--kato-text-secondary);
	}
</style>
