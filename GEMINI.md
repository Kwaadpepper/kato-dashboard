## Project Configuration

- **Language**: TypeScript
- **Package Manager**: npm
- **Add-ons**: none

---

# Kato — Règles Projet

## Projet
Kato est un dashboard de monitoring haute densité (1 à 200+ sondes, zéro scroll). Il agrège des APIs de monitoring tierces (Uptime Robot, etc.) et affiche l'état en temps réel sur un écran TV/desktop/mobile.

## Stack Technique (OBLIGATOIRE)
- **Framework** : SvelteKit (Svelte 5 avec runes `$state`, `$derived`, `$effect`) + `@sveltejs/adapter-node`
- **CSS** : Tailwind CSS v4 + PostCSS. Pas de CSS-in-JS. Pas de styled-components.
- **Langage** : TypeScript strict partout (front + back). Pas de `any` sauf cas justifié.
- **Communication temps réel** : SSE (Server-Sent Events) via `EventSource`. PAS de WebSocket.
- **Icônes** : Lucide Icons (import tree-shakable) ou inline SVG.
- **Pas de base de données**. Tout l'état est en RAM (in-memory). Restart = reset.

## Conventions de Code
- Noms de fichiers composants : PascalCase (ex: `ProbeGrid.svelte`)
- Noms de fichiers utilitaires : kebab-case (ex: `grid-calculator.ts`)
- Tous les types/interfaces dans `src/lib/types/index.ts`
- Code serveur (BFF) dans `src/lib/server/` — jamais importé côté client
- Code client dans `src/lib/components/` et `src/lib/utils/`
- Adapter pattern : chaque source de données implémente `MonitoringAdapter` dans `src/lib/server/adapters/`
- Variables d'environnement : préfixées `KATO_` ou nom du service (ex: `UPTIMEROBOT_API_KEY`)

## Règles UI/UX
- **Zéro scroll** sur desktop en mode dashboard (overflow: hidden). Exception : mobile uniquement.
- La grille se calcule automatiquement pour remplir 100% du viewport.
- Les sondes DOWN sont toujours affichées en premier (haut-gauche).
- Les animations respectent `prefers-reduced-motion`.
- Thème dark par défaut. Couleurs sémantiques : UP=#10B981, DOWN=#EF4444, DEGRADED=#F59E0B, PAUSED=#6B7280, PENDING=#3B82F6, MAINTENANCE=#8B5CF6.

## Règles Serveur (BFF)
- Les clés API tierces ne transitent JAMAIS vers le client.
- L'endpoint SSE est à `/api/events` — envoie `init` (état complet), `update` (deltas), `heartbeat` (15s).
- Le polling des APIs tierces est géré côté serveur (pas côté client).
- Gestion des erreurs API : ne jamais crasher. Log + garder dernier état connu.

## Documentation de Référence
Consulte les fichiers dans `docs/` pour les détails techniques :
- `docs/ARCHITECTURE.md` — Architecture en couches, flux de données
- `docs/DATA_MODEL.md` — Interfaces TypeScript canoniques (NormalizedProbe, etc.)
- `docs/UX_COMPONENTS.md` — Specs visuelles de chaque composant avec classes Tailwind
- `docs/GRID_ALGORITHM.md` — Algorithme de calcul de grille adaptative
- `docs/UPTIME_ROBOT_API.md` — Référence API Uptime Robot v3 et implémentation adapter
- `docs/COLORS_AND_THEME.md` — Palette couleurs, animations CSS, thèmes

## Mode TV
- Activé via `?tv=1` dans l'URL
- Fullscreen auto, curseur masqué après 5s, anti burn-in (drift ±3px / 10min)
- Le dashboard doit pouvoir tourner 30 jours sans rechargement ni memory leak
