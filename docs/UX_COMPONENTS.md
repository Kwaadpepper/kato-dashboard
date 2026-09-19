# Composants UX — Kato

Ce document constitue la spécification technique et visuelle de référence pour l'ensemble des composants d'interface du dashboard de monitoring Kato. Il définit pour chaque composant Svelte sa structure, son comportement dynamique, ses règles d'affichage réactif et l'exhaustivité des classes Tailwind CSS à appliquer.

---

### Modèle TypeScript de Référence

```typescript
// types/probe.ts

export type ProbeStatus = 
  | 'up' 
  | 'down' 
  | 'degraded' 
  | 'paused' 
  | 'pending' 
  | 'maintenance';

export interface Probe {
  id: string;
  name: string;
  url: string;
  status: ProbeStatus;
  uptimePercent: number;        // Ex: 99.95
  responseTimeMs: number;       // Latence en millisecondes
  history?: number[];           // Relevés récents pour sparkline
  lastCheckedAt: string;        // ISO 8601
  downSince?: string;           // ISO 8601 si statut == 'down'
}

export type DensityMode = 'large' | 'medium' | 'compact' | 'micro' | 'pixel';
```

---

## 1. Header (`Header.svelte`)

Le Header est un bandeau fixe positionné en haut de l'écran qui fournit la vue macroscopique de la santé de l'infrastructure surveillée.

### 1.1 Géométrie & Styles Généraux
- **Positionnement** : Fixé en haut (`fixed top-0 left-0 right-0 z-50 w-full`).
- **Hauteur standard** : ~48px (`h-12`).
- **Fond & Glassmorphism** : `bg-slate-900/80 backdrop-blur-sm border-b border-slate-800/60`.
- **Mode Haute Densité (> 100 sondes)** : Le bandeau se réduit à ~32px (`h-8`), avec un padding vertical condensé (`py-1`) et un texte plus compact.
- **Responsive Mobile (`< 768px`)** : Seuls le score (`197/200 UP`), les badges compteurs et l'horloge sont conservés ; le logo textuel et l'indicateur de fraîcheur textuel sont masqués pour éviter tout débordement.

### 1.2 Structure & Éléments (Gauche à Droite)

1. **Logo KATO** :
   - Classes : `text-lg font-bold text-white tracking-wider select-none shrink-0`.
   - En mode haute densité : `text-sm font-extrabold`.

2. **Score Global** :
   - Format : `197/200 UP`.
   - Typographie : Grand chiffre à espacement fixe (`font-mono font-bold text-sm sm:text-base`).
   - Règles de coloration dynamique selon le taux de disponibilité :
     - **> 95%** : `text-emerald-400`
     - **> 80% et ≤ 95%** : `text-amber-400`
     - **≤ 80%** : `text-red-400 animate-pulse`

3. **Badges Compteurs** :
   - Pastilles arrondies affichant le nombre de sondes par statut : `🟢 197`, `🟡 1`, `🔴 2`, `⏸ 0`.
   - Structure commune : `flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium font-mono shrink-0`.
   - Nuances de fond et de bordure par statut :
     - **UP (🟢)** : `bg-emerald-950/60 text-emerald-300 border border-emerald-800/50`
     - **DEGRADED (🟡)** : `bg-amber-950/60 text-amber-300 border border-amber-800/50`
     - **DOWN (🔴)** : `bg-red-950/60 text-red-300 border border-red-800/60` (ajoute `animate-pulse` si count > 0)
     - **PAUSED (⏸)** : `bg-slate-800/50 text-slate-300 border border-slate-700/50`
     - **PENDING / MAINTENANCE** : `bg-violet-950/60 text-violet-300 border border-violet-800/50`

4. **Spacer** :
   - Séparateur flexible occupant tout l'espace disponible : `flex-1`.

5. **Horloge Temps Réel** :
   - Affiche l'heure locale : `text-slate-400 font-mono text-sm tracking-tight shrink-0`.
   - Format : `HH:MM:SS`.

6. **Indicateur de Fraîcheur** :
   - Affichage : `"↻ 12s"` (temps écoulé depuis la dernière réception de payload).
   - Base : `font-mono text-xs px-2 py-0.5 rounded-md border flex items-center gap-1 shrink-0`.
   - Seuils de couleur :
     - **< 30s (Vert)** : `text-emerald-400 border-emerald-900/40 bg-emerald-950/20`
     - **30s à 60s (Ambre)** : `text-amber-400 border-amber-900/40 bg-amber-950/20`
     - **> 60s (Rouge)** : `text-red-400 border-red-900/50 bg-red-950/30 font-bold animate-pulse`

### 1.3 Exemple Svelte 5 / TypeScript

```svelte
<!-- src/lib/components/Header.svelte -->
<script lang="ts">
  import type { Probe } from '$lib/types/probe';

  let {
    probes = [],
    lastUpdatedSecondsAgo = 0,
    currentTime = '00:00:00',
    isHighDensity = false
  }: {
    probes: Probe[];
    lastUpdatedSecondsAgo: number;
    currentTime: string;
    isHighDensity?: boolean;
  } = $props();

  const total = $derived(probes.length);
  const countUp = $derived(probes.filter((p) => p.status === 'up').length);
  const countDown = $derived(probes.filter((p) => p.status === 'down').length);
  const countDegraded = $derived(probes.filter((p) => p.status === 'degraded').length);
  const countPaused = $derived(probes.filter((p) => p.status === 'paused').length);

  const upRatio = $derived(total > 0 ? (countUp / total) * 100 : 100);

  const scoreColor = $derived(
    upRatio > 95 ? 'text-emerald-400' : upRatio > 80 ? 'text-amber-400' : 'text-red-400'
  );

  const freshnessColor = $derived(
    lastUpdatedSecondsAgo < 30
      ? 'text-emerald-400 border-emerald-900/40 bg-emerald-950/20'
      : lastUpdatedSecondsAgo < 60
        ? 'text-amber-400 border-amber-900/40 bg-amber-950/20'
        : 'text-red-400 border-red-900/50 bg-red-950/30 animate-pulse'
  );
</script>

<header
  class="fixed top-0 left-0 right-0 z-50 w-full bg-slate-900/80 backdrop-blur-sm border-b border-slate-800/60 flex items-center px-4 justify-between transition-all duration-150 {isHighDensity ? 'h-8 text-xs' : 'h-12'}"
>
  <div class="flex items-center gap-3 sm:gap-4">
    <span class="hidden md:inline font-bold text-white tracking-wider select-none {isHighDensity ? 'text-sm' : 'text-lg'}">
      KATO
    </span>
    <span class="font-mono font-bold text-sm sm:text-base {scoreColor}">
      {countUp}/{total} UP
    </span>

    <div class="flex items-center gap-1.5">
      <span class="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium font-mono bg-emerald-950/60 text-emerald-300 border border-emerald-800/50">
        <span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> {countUp}
      </span>
      {#if countDegraded > 0}
        <span class="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium font-mono bg-amber-950/60 text-amber-300 border border-amber-800/50">
          <span class="w-1.5 h-1.5 rounded-full bg-amber-400"></span> {countDegraded}
        </span>
      {/if}
      {#if countDown > 0}
        <span class="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium font-mono bg-red-950/60 text-red-300 border border-red-800/60 animate-pulse">
          <span class="w-1.5 h-1.5 rounded-full bg-red-400"></span> {countDown}
        </span>
      {/if}
      {#if countPaused > 0}
        <span class="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium font-mono bg-slate-800/50 text-slate-300 border border-slate-700/50">
          <span class="w-1.5 h-1.5 rounded-full bg-slate-400"></span> {countPaused}
        </span>
      {/if}
    </div>
  </div>

  <div class="flex-1"></div>

  <div class="flex items-center gap-3">
    <span class="text-slate-400 font-mono text-sm">{currentTime}</span>
    <span class="hidden sm:flex font-mono text-xs px-2 py-0.5 rounded-md border {freshnessColor}">
      ↻ {lastUpdatedSecondsAgo}s
    </span>
  </div>
</header>
```

---

## 2. ProbeGrid (`ProbeGrid.svelte`)

Le conteneur de grille présente l'ensemble des sondes supervisées. Il optimise l'espace afin d'éviter tout défilement vertical sur les écrans fixes de monitoring.

### 2.1 Géométrie & Contraintes d'Espace
- **Container principal** : `w-full h-[calc(100vh-48px-40px)]` (Viewport total - Header 48px - IncidentBar 40px).
- **Défilement** : `overflow-hidden` strict en usage TV / Desktop. Le défilement vertical (`overflow-y-auto`) n'est autorisé que sur les résolutions mobiles (`< 768px`).

### 2.2 Système de Grille CSS & Calculateur Dynamique
- Utilisation directe de CSS Grid :
  ```css
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(var(--cell-min-width), 1fr));
  gap: var(--grid-gap);
  ```
- La largeur minimale `Xpx` et l'espacement `gap` sont calculés dynamiquement par `grid-calculator.ts` :
  - **Pixel mode (200+ sondes)** : gap `4px`
  - **Micro mode (81-200 sondes)** : gap `6px`
  - **Compact mode (25-80 sondes)** : gap `8px`
  - **Medium / Large mode (1-24 sondes)** : gap `12px`

### 2.3 Calculateur de Grille (`grid-calculator.ts`)

```typescript
// utils/grid-calculator.ts
import type { DensityMode } from '$lib/types/probe';

export interface GridParameters {
  mode: DensityMode;
  minCellWidth: number;
  gapPx: number;
}

export function computeGridParameters(totalProbes: number): GridParameters {
  if (totalProbes <= 6) {
    return { mode: 'large', minCellWidth: 280, gapPx: 12 };
  }
  if (totalProbes <= 24) {
    return { mode: 'medium', minCellWidth: 200, gapPx: 12 };
  }
  if (totalProbes <= 80) {
    return { mode: 'compact', minCellWidth: 140, gapPx: 8 };
  }
  if (totalProbes <= 200) {
    return { mode: 'micro', minCellWidth: 32, gapPx: 6 };
  }
  return { mode: 'pixel', minCellWidth: 16, gapPx: 4 };
}
```

### 2.4 Promotion Spatiale des Pannes & Animation FLIP
- **Règle de tri prioritaire** : Les sondes au statut `down` sont obligatoirement triées en premier (affichées en haut à gauche de la grille). Elles sont suivies des statuts `degraded`, puis `maintenance`, `pending`, `paused` et enfin `up`.
- **Réorganisation animée** : Les cellules utilisent la directive Svelte `animate:flip={{ duration: 350 }}` afin de glisser fluidement vers leur nouvelle position lors des changements d'état sans rechargement brusque.

---

## 3. ProbeCell (`ProbeCell.svelte`) — Mode Large (1-6 sondes)

Le mode Large s'active lorsque le cluster comporte entre 1 et 6 sondes. Il fournit le niveau de détail maximal.

### 3.1 Carte & Habillage selon le Statut
- **Boîte principale** : `rounded-xl p-4 shadow-lg flex flex-col justify-between h-full relative overflow-hidden transition-all duration-200`.
- **Nuancier de bordure et de fond selon le statut** :
  - **`up`** : `bg-emerald-900/30 border border-emerald-700/50`
  - **`down`** : `bg-red-900/40 border border-red-500/60`
  - **`degraded`** : `bg-amber-900/30 border border-amber-600/50`
  - **`paused`** : `bg-slate-800/50 border border-slate-600/30`
  - **`pending`** : `bg-blue-900/30 border border-blue-600/40`
  - **`maintenance`** : `bg-violet-900/30 border border-violet-600/40`

### 3.2 Contenu Détaillé
1. **Coin supérieur droit** : Icône de statut ou pastille lumineuse (`w-3.5 h-3.5 rounded-full shadow-sm`).
2. **Nom complet** : `text-base font-semibold text-white truncate pr-6`.
3. **URL cible tronquée** : `text-xs text-slate-400 font-mono truncate mt-0.5`.
4. **Uptime %** : Métrique dominante en `text-2xl font-bold font-mono tracking-tight text-white`.
5. **Response time** : `text-sm font-mono text-slate-300` (ex: `42 ms`).
6. **Mini sparkline** (optionnel) : Tracé SVG discret de 24px de haut en bas de carte matérialisant les 15 dernières latences.

```html
<!-- Exemple DOM Mode Large -->
<article class="rounded-xl p-4 shadow-lg bg-emerald-900/30 border border-emerald-700/50 flex flex-col justify-between h-full">
  <div class="flex justify-between items-start">
    <div class="min-w-0 pr-3">
      <h3 class="text-base font-semibold text-white truncate">Cluster Kubernetes Core</h3>
      <p class="text-xs text-slate-400 font-mono truncate">https://k8s.internal.infra/healthz</p>
    </div>
    <span class="w-3.5 h-3.5 rounded-full bg-emerald-400 shrink-0 mt-1 shadow-sm"></span>
  </div>

  <div class="mt-4 flex items-end justify-between">
    <div>
      <span class="text-xs text-slate-400 uppercase tracking-wider block font-sans">Uptime 30j</span>
      <span class="text-2xl font-bold font-mono text-emerald-300">99.98%</span>
    </div>
    <div class="text-right">
      <span class="text-xs text-slate-400 uppercase tracking-wider block font-sans">Latence</span>
      <span class="text-sm font-mono text-slate-200">18 ms</span>
    </div>
  </div>
</article>
```

---

## 4. ProbeCell — Mode Medium (7-24 sondes)

Le mode Medium optimise l'occupation de surface pour des clusters intermédiaires (7 à 24 sondes) en condensant les informations tout en conservant les métriques clés.

### 4.1 Spécifications
- **Carte** : `rounded-lg p-3 flex flex-col justify-between border shadow-md relative overflow-hidden`.
- **Fonds & bordures** : Identiques aux classes par statut définies en Section 3.
- **Contenu** :
  - **Ligne supérieure** :
    - Nom de la sonde : `text-sm font-medium text-white truncate pr-2`.
    - Pastille de statut : `w-2 h-2 rounded-full shrink-0` (ex: `bg-emerald-400`, `bg-red-500`).
  - **Ligne inférieure** :
    - Uptime % : `text-lg font-bold font-mono text-slate-100`.
    - Response time : `text-xs font-mono text-slate-300`.

```html
<!-- Exemple DOM Mode Medium -->
<article class="rounded-lg p-3 bg-emerald-900/30 border border-emerald-700/50 flex flex-col justify-between">
  <div class="flex items-center justify-between gap-2">
    <h3 class="text-sm font-medium text-white truncate">Elasticsearch Cluster</h3>
    <span class="w-2 h-2 rounded-full bg-emerald-400 shrink-0"></span>
  </div>
  <div class="mt-2 flex items-baseline justify-between">
    <span class="text-lg font-bold font-mono text-emerald-300">100%</span>
    <span class="text-xs font-mono text-slate-300">23 ms</span>
  </div>
</article>
```

---

## 5. ProbeCell — Mode Compact (25-80 sondes)

Le mode Compact maximise la visibilité d'ensemble pour les parcs denses (25 à 80 sondes) en adoptant un format ultra-synthétique.

### 5.1 Spécifications
- **Carte** : `rounded-md p-2 relative flex items-center justify-between overflow-hidden border shadow-sm`.
- **Fond teinté** : Le fond entier adopte la couleur du statut à opacité modérée :
  - UP : `bg-emerald-950/40 border-emerald-800/40`
  - DOWN : `bg-red-950/50 border-red-800/60`
  - DEGRADED : `bg-amber-950/40 border-amber-800/40`
  - PAUSED : `bg-slate-850/50 border-slate-700/40`
- **Bande latérale de couleur** : Une bande colorée pleine est plaquée sur la gauche :
  - Classes : `w-1 h-full rounded-full absolute left-0 top-0 bottom-0`.
  - Couleur : `bg-emerald-500` (UP), `bg-red-500` (DOWN), `bg-amber-500` (DEGRADED), `bg-slate-500` (PAUSED).
- **Contenu textuel** :
  - Nom : `text-xs font-medium text-white truncate pl-2`.
  - Latence compacte : `text-[11px] font-mono text-slate-300 shrink-0 ml-1`.

```html
<!-- Exemple DOM Mode Compact -->
<article class="rounded-md p-2 relative flex items-center justify-between overflow-hidden bg-emerald-950/40 border border-emerald-800/40">
  <div class="w-1 h-full rounded-full absolute left-0 top-0 bottom-0 bg-emerald-500"></div>
  <span class="text-xs font-medium text-white truncate pl-2">Redis-Master-01</span>
  <span class="text-[11px] font-mono text-slate-300 shrink-0 ml-1">2 ms</span>
</article>
```

---

## 6. ProbeDot (`ProbeDot.svelte`) — Mode Micro (81-200 sondes)

Lorsque le dashboard gère entre 81 et 200 sondes, les cellules textuelles laissent place à des puces circulaires haute densité.

### 6.1 Spécifications
- **Format** : Cercle plein `w-8 h-8 rounded-full` (ou `w-6 h-6 rounded-full` si la grille dépasse 150 éléments).
- **Couleur de fond** = couleur pleine du statut :
  - UP : `bg-emerald-500 hover:bg-emerald-400`
  - DOWN : `bg-red-500 hover:bg-red-400 animate-pulse`
  - DEGRADED : `bg-amber-500 hover:bg-amber-400`
  - PAUSED : `bg-slate-600 hover:bg-slate-500`
  - MAINTENANCE / PENDING : `bg-violet-500 hover:bg-violet-400`
- **Texte visible** : Aucun texte directement imprimé sur le composant.
- **Tooltip au hover / focus** : Infobulle contextuelle flottante affichant :
  - Nom complet de la sonde
  - Statut actuel en majuscule
  - Temps de réponse en ms

```html
<!-- Exemple DOM Mode Micro avec Tooltip CSS -->
<div class="relative group flex items-center justify-center">
  <button 
    class="w-7 h-7 rounded-full bg-emerald-500 hover:scale-110 transition-transform duration-150 focus:outline-none focus:ring-2 focus:ring-emerald-400"
    aria-label="Postgres Master: UP"
  ></button>
  
  <div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:flex flex-col items-center z-50 pointer-events-none">
    <div class="bg-slate-900 text-white text-xs rounded py-1 px-2.5 shadow-2xl border border-slate-700 whitespace-nowrap font-mono">
      <p class="font-bold text-slate-100">Postgres Master</p>
      <p class="text-emerald-400">UP — 4 ms</p>
    </div>
    <div class="w-1.5 h-1.5 bg-slate-900 border-r border-b border-slate-700 rotate-45 -mt-1"></div>
  </div>
</div>
```

---

## 7. ProbeDot — Mode Pixel (200+ sondes)

Au-delà de 200 sondes, le dashboard bascule en mode pixel matérialisant une cartographie thermique exhaustive de l'infrastructure.

### 7.1 Spécifications
- **Format** : Carré miniature `w-4 h-4 rounded-sm` (ou `w-3 h-3 rounded-[1px]` au-delà de 400 sondes).
- **Couleur** = couleur pleine du statut (identique au mode Micro).
- **Interaction** : Tooltip au survol affichant nom, statut et latence. Mise en valeur au hover : `hover:scale-150 hover:z-20 shadow-md`.
- **Légende Séparée** : En bas de la grille ou au-dessus de l'IncidentBar, un bandeau fixe affiche la clé de lecture :
  - `🟢 UP` `🔴 DOWN` `🟡 DEGRADED` `⏸ PAUSED` `🟣 MAINTENANCE`

---

## 8. IncidentBar (`IncidentBar.svelte`)

Bandeau fixe ancré au bas de l'écran affichant la synthèse des alertes et incidents non résolus.

### 8.1 Géométrie & Styles de Base
- **Position & Hauteur** : Fixé en bas (`fixed bottom-0 left-0 right-0 z-40 w-full h-10`).
- **Fond nominal (zéro incident)** : `bg-slate-900/90 border-t border-slate-700/50`.
- **Texte nominal** : `text-slate-500 text-sm font-medium flex items-center justify-center gap-2 select-none` → `"✓ Aucun incident actif"`.
- **Fond en incident actif** : `bg-red-950/80 border-t border-red-800/60 backdrop-blur-sm text-red-200`.

### 8.2 Mode TV : Défilement Automatique Horizontal (Marquee)
En mode TV, lorsque des incidents sont présents, le bandeau fait défiler les incidents en boucle continue via une animation CSS Marquee fluide :

```css
@keyframes marquee-scroll {
  0% {
    transform: translateX(0%);
  }
  100% {
    transform: translateX(-50%);
  }
}

.animate-marquee {
  display: flex;
  width: max-content;
  animation: marquee-scroll 24s linear infinite;
}

.animate-marquee:hover {
  animation-play-state: paused;
}
```

### 8.3 Mode Desktop & Format d'Incident
- Sur desktop, tous les incidents sont affichés en ligne avec défilement horizontal fluide si nécessaire (`overflow-x-auto no-scrollbar`).
- **Composition de chaque élément d'incident** :
  - Icône statut : `🔴` ou icône SVG triangulaire d'alerte `text-red-400 font-bold`.
  - Nom de la sonde : `font-semibold text-white text-xs sm:text-sm`.
  - Durée de la panne : `font-mono text-xs text-red-300` (ex: `depuis 4m 12s`).

```svelte
<!-- src/lib/components/IncidentBar.svelte -->
<script lang="ts">
  import type { Probe } from '$lib/types/probe';

  let { downProbes = [], isTvMode = false }: { downProbes: Probe[]; isTvMode?: boolean } = $props();

  function formatDuration(downSince?: string): string {
    if (!downSince) return 'récent';
    const diffSec = Math.max(0, Math.floor((Date.now() - new Date(downSince).getTime()) / 1000));
    const mins = Math.floor(diffSec / 60);
    const secs = diffSec % 60;
    return `${mins}m ${secs}s`;
  }
</script>

{#if downProbes.length === 0}
  <footer class="fixed bottom-0 left-0 right-0 z-40 h-10 bg-slate-900/90 border-t border-slate-700/50 flex items-center justify-center">
    <span class="text-slate-500 text-sm font-medium flex items-center gap-2 select-none">
      <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
      Aucun incident actif
    </span>
  </footer>
{:else}
  <footer class="fixed bottom-0 left-0 right-0 z-40 h-10 bg-red-950/80 border-t border-red-800/60 backdrop-blur-sm overflow-hidden flex items-center px-4">
    <div class="flex items-center gap-2 font-bold text-xs uppercase tracking-wider text-red-300 shrink-0 pr-4 border-r border-red-800/60 mr-4">
      <span class="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping"></span>
      Incidents ({downProbes.length})
    </div>

    <div class="flex-1 overflow-hidden">
      <div class={isTvMode ? 'animate-marquee flex items-center gap-8' : 'flex items-center gap-6 overflow-x-auto'}>
        {#each downProbes as probe (probe.id)}
          <div class="flex items-center gap-2 shrink-0 text-sm text-red-200 font-mono">
            <span class="text-red-400">🔴</span>
            <span class="font-bold text-white">{probe.name}</span>
            <span class="text-xs text-red-300">({formatDuration(probe.downSince)})</span>
          </div>
        {/each}
      </div>
    </div>
  </footer>
{/if}
```

---

## 9. Animations d'Alerte

Afin de garantir un repérage immédiat des dysfonctionnements, les animations d'alerte suivent des critères visuels standardisés.

### 9.1 Définition des Keyframes CSS

```css
/* 1. Pulse Alert : variation douce de scale et d'opacité sur les sondes DOWN */
@keyframes pulse-alert {
  0%, 100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.03);
    opacity: 0.85;
  }
}

/* 2. Border Flash : flash écarlate de 2s lors d'une bascule UP -> DOWN */
@keyframes border-flash {
  0%, 100% {
    border-color: transparent;
  }
  50% {
    border-color: theme('colors.red.500');
  }
}
```

### 9.2 Règles d'Application des Alertes
1. **Pulse** : `@keyframes pulse-alert` est appliqué en continu sur toutes les cellules de statut `down`.
2. **Glow** : Si une cellule reste au statut `down` pendant plus d'une minute (> 60s), un halo lumineux est ajouté :
   ```css
   box-shadow: 0 0 20px rgba(239, 68, 68, 0.4);
   ```
3. **Promotion Spatiale** : Les cellules `down` sont ordonnées en tête de liste dans la grille (aucun composant ne gère son propre déplacement en dur : c'est le tri réactif combiné à `animate:flip` qui déplace la cellule en haut à gauche).
4. **Flash Bordure** : Lorsqu'une transition `up` → `down` se produit, une bordure clignotante est appliquée pendant 2 secondes sur le conteneur principal `ProbeGrid` :
   ```css
   border: 2px solid transparent;
   animation: border-flash 0.5s ease-in-out 4;
   ```
5. **Fond d'Alerte Majeur** : Dès que **≥ 30%** des sondes supervisées sont au statut `down`, le fond global du dashboard (`body` ou balise `<main>`) bascule de `bg-slate-950` à `bg-red-950/20`.

### 9.3 Respect de `prefers-reduced-motion`

Toutes les animations doivent obligatoirement être désactivées pour les utilisateurs ayant activé la réduction de mouvement :

```css
@media (prefers-reduced-motion: reduce) {
  *,
  ::before,
  ::after {
    animation: none !important;
    transition: none !important;
  }
  
  /* L'état DOWN reste signalé de façon statique via bordure rouge pleine */
  .probe-down {
    border-color: #ef4444 !important;
    transform: none !important;
  }
}
```

---

## 10. LoginForm (`LoginForm.svelte`)

Composant d'authentification autonome et centré pour l'accès sécurisé à l'interface Kato.

### 10.1 Positionnement & Carte
- **Centrage** : Centré verticalement et horizontalement au sein du viewport (`min-h-screen w-full flex items-center justify-center p-4 bg-slate-950`).
- **Card** : `w-full max-w-sm mx-auto rounded-2xl bg-slate-800/50 p-8 backdrop-blur-sm border border-slate-700/50 shadow-2xl`.

### 10.2 Éléments du Formulaire
1. **Logo KATO** : Placé en haut de la carte (`text-2xl font-black tracking-widest text-white text-center mb-6`).
2. **Champ mot de passe unique** :
   - Classes : `w-full rounded-lg bg-slate-700/50 border border-slate-600 px-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all font-mono`.
   - Placeholder : `••••••••••••`.
3. **Bouton submit** :
   - Classes : `w-full mt-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 px-4 py-3 font-medium text-white transition-colors duration-150 shadow-lg shadow-emerald-900/30`.
4. **Message d'erreur** :
   - En cas d'échec de vérification : `mt-4 p-3 rounded-lg bg-red-950/50 border border-red-800/60 text-xs font-semibold text-red-300 text-center`.

---

## 11. Thèmes

Kato implémente un système de personnalisation à 3 thèmes via Custom Properties CSS et la classe racine `data-theme` sur l'élément `<html>`.

### 11.1 Définition des Variables CSS

| Thème | `--bg-primary` | `--bg-secondary` | Description |
| :--- | :--- | :--- | :--- |
| **Dark (défaut)** | `#0F172A` (Slate 900) | `#1E293B` (Slate 800) | Thème sombre standard optimisé pour la lisibilité |
| **Light** | `#F8FAFC` (Slate 50) | `#FFFFFF` (Pure White) | Environnements bureautiques lumineux |
| **AMOLED** | `#000000` (Pure Black) | `#0A0A0A` (Deep Black) | Consommation nulle de rétroéclairage sur dalles OLED |

```css
/* app.css */
:root,
[data-theme="dark"] {
  --bg-primary: #0F172A;
  --bg-secondary: #1E293B;
  --text-main: #F8FAFC;
  --border-muted: #334155;
}

[data-theme="light"] {
  --bg-primary: #F8FAFC;
  --bg-secondary: #FFFFFF;
  --text-main: #0F172A;
  --border-muted: #E2E8F0;
}

[data-theme="amoled"] {
  --bg-primary: #000000;
  --bg-secondary: #0A0A0A;
  --text-main: #FFFFFF;
  --border-muted: #262626;
}
```

### 11.2 Intégration Tailwind CSS

```javascript
// tailwind.config.cjs
module.exports = {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        theme: {
          primary: 'var(--bg-primary)',
          secondary: 'var(--bg-secondary)',
          text: 'var(--text-main)',
          border: 'var(--border-muted)',
        }
      }
    }
  }
};
```

---

## 12. Mode TV

Le mode TV adapte l'interface Kato pour un affichage passif 24/7 sur écrans muraux, téléviseurs de surveillance et affichage dynamique.

### 12.1 Activation & Contrôle Plein Écran
- **Déclencheur d'activation** : Présence du paramètre `?tv=1` dans l'URL ou activation du switch dans les préférences.
- **Plein écran automatique** : Appel de `document.documentElement.requestFullscreen()` lors de l'interaction initiale de l'utilisateur ou au chargement de la page si autorisé par la policy du navigateur.

### 12.2 Masquage Automatique du Curseur
- Le curseur de la souris est masqué après 5 secondes d'inactivité :
  ```css
  body.cursor-hidden {
    cursor: none !important;
  }
  ```
- Un écouteur d'événement `mousemove` réinitialise un timer de 5 secondes :
  ```typescript
  let timer: number;
  window.addEventListener('mousemove', () => {
    document.body.classList.remove('cursor-hidden');
    clearTimeout(timer);
    timer = window.setTimeout(() => {
      document.body.classList.add('cursor-hidden');
    }, 5000);
  });
  ```

### 12.3 Prévention du Marquage d'Écran (Anti Burn-in)
Pour éviter la détérioration des matrices OLED et LCD soumises à des éléments statiques (lignes de grille, en-tête), le conteneur principal subit un décalage orbital subtil de ±3 pixels toutes les 10 minutes :

```typescript
// utils/anti-burnin.ts
export function enableAntiBurnIn(containerElement: HTMLElement) {
  const shifts = [
    { x: 0, y: 0 },
    { x: 3, y: -2 },
    { x: -3, y: 2 },
    { x: 2, y: 3 },
    { x: -2, y: -3 }
  ];
  let index = 0;

  setInterval(() => {
    index = (index + 1) % shifts.length;
    const { x, y } = shifts[index];
    containerElement.style.transform = `translate(${x}px, ${y}px)`;
    containerElement.style.transition = 'transform 2s ease-in-out';
  }, 10 * 60 * 1000); // Toutes les 10 minutes
}
```

### 12.4 Adaptations Visuelles Dédiées au Mode TV
1. **Header Ultra-Compact** : Hauteur réduite à `h-8` (`32px`) avec épuration des éléments secondaires.
2. **IncidentBar en mode Marquee** : Défilement automatique continu des incidents pour assurer une lisibilité complète même lorsque de multiples incidents coexistent.
