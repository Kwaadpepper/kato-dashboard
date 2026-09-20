<script lang="ts">
	import X from 'lucide-svelte/icons/x';
	import Keyboard from 'lucide-svelte/icons/keyboard';

	let {
		isOpen = false,
		onclose
	}: {
		isOpen: boolean;
		onclose: () => void;
	} = $props();

	let dialogElement: HTMLElement | null = $state(null);
	let closeButtonElement: HTMLButtonElement | null = $state(null);
	let previousActiveElement: HTMLElement | null = null;

	const shortcuts = [
		{ keys: ['↑', '↓', '←', '→'], desc: 'Naviguer dans la grille de sondes (navigation 2D)' },
		{ keys: ['Début', 'Fin'], desc: 'Aller à la première sonde (DOWN) ou à la dernière' },
		{ keys: ['Entrée', 'Espace'], desc: 'Ouvrir la fiche détaillée de la sonde sélectionnée' },
		{ keys: ['Échap'], desc: 'Fermer la vue détail / menu / quitter le plein écran' },
		{ keys: ['F'], desc: 'Basculer en plein écran' },
		{ keys: ['M'], desc: 'Activer / couper le son des alertes' },
		{ keys: ['T'], desc: 'Changer de thème (Sombre, Clair, AMOLED, Auto)' },
		{ keys: ['P'], desc: 'Mettre en pause / reprendre le défilement des incidents' },
		{ keys: ['Tab', 'Maj + Tab'], desc: 'Naviguer séquentiellement entre les zones' },
		{ keys: ['?'], desc: 'Ouvrir ou fermer cette aide clavier' }
	];

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
	<!-- Overlay d'arrière-plan -->
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 transition-opacity duration-200"
		onclick={onclose}
	>
		<!-- Boîte de dialogue modale -->
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
			<!-- En-tête -->
			<div class="flex items-center justify-between pb-3 border-b border-[var(--kato-border)]">
				<div class="flex items-center gap-2.5">
					<div class="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
						<Keyboard class="w-5 h-5" aria-hidden="true" />
					</div>
					<div>
						<h2 id="keyboard-help-title" class="text-base font-bold">
							Raccourcis Clavier & Accessibilité
						</h2>
						<p class="text-xs text-[var(--kato-text-secondary)]">
							Contrôlez l'ensemble du dashboard sans toucher la souris
						</p>
					</div>
				</div>

				<button
					bind:this={closeButtonElement}
					type="button"
					onclick={onclose}
					class="p-1.5 rounded-lg hover:bg-slate-800 text-[var(--kato-text-secondary)] hover:text-white transition-colors cursor-pointer"
					aria-label="Fermer l'aide des raccourcis clavier"
				>
					<X class="w-5 h-5" aria-hidden="true" />
				</button>
			</div>

			<!-- Liste des raccourcis -->
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

			<!-- Pied de page -->
			<div class="pt-2 border-t border-[var(--kato-border)] flex items-center justify-between text-xs text-[var(--kato-text-secondary)]">
				<span>Astuce : appuyez sur <kbd class="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono text-[10px] text-white">Échap</kbd> pour fermer à tout moment</span>
				<button
					type="button"
					onclick={onclose}
					class="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition-colors cursor-pointer text-xs"
				>
					Fermer
				</button>
			</div>
		</div>
	</div>
{/if}
