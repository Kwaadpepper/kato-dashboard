# Kato — Playbook Vibe Coding

> **16 prompts séquencés avec modèle recommandé** pour construire Kato de A à Z.
> Ouvre une nouvelle conversation Antigravity dans `/var/www-jeremy/projets/kato-dashboard/` et envoie les prompts dans l'ordre.

---

## 🚀 Avant de Commencer

1. **Le `GEMINI.md`** à la racine du projet est chargé automatiquement → l'agent connaît la stack et les règles
2. **Les `docs/`** sont référencés dans les prompts → l'agent lit les specs quand il en a besoin
3. **Vérifie entre chaque prompt** : `npm run dev` doit tourner, pas d'erreur TS
4. **Garde la même conversation** le plus longtemps possible (contexte cumulé)
5. Après le prompt 8, tu peux ouvrir de nouvelles conversations pour les prompts 10-15

### Légende des modèles

| Badge | Modèle | Usage |
| --- | --- | --- |
| 🏎️ | **Gemini 3.8 Flash** | Génération rapide, code bien spécifié |
| ⚡ | **Claude Sonnet 4.6 (Thinking)** | Logique subtile, APIs, lifecycle |
| 🧠 | **Claude Opus 4.6 (Thinking)** | Assemblage complexe, debug, audit |

---

## Prompt 0 — Initialisation du projet

> 🏎️ **Gemini 3.8 Flash** · Crée: structure projet · Dépend de: rien

```
Initialise un nouveau projet SvelteKit dans /var/www-jeremy/projets/kato-dashboard/.

Étapes :
1. Initialise SvelteKit avec : npx sv create . --template minimal --types ts --no-add-ons
   (Si sv n'est pas dispo, utilise npx create-svelte@latest)
2. Installe les dépendances : npm install
3. Installe Tailwind CSS v4 pour SvelteKit : npx sv add tailwindcss
4. Installe @sveltejs/adapter-node : npm install -D @sveltejs/adapter-node
5. Installe lucide-svelte : npm install lucide-svelte
6. Installe dotenv : npm install dotenv

Configure :
- svelte.config.js : utilise adapter-node au lieu d'adapter-auto
- Crée le fichier .env.example avec :
  KATO_ADAPTER=mock
  KATO_AUTH_ENABLED=false
  KATO_AUTH_PASSWORD=changeme
  UPTIMEROBOT_API_KEY=
  UPTIMEROBOT_POLL_INTERVAL=30000
  PORT=3000
  HOST=0.0.0.0
- Crée .env en copiant .env.example
- Ajoute .env au .gitignore
- Crée la structure de dossiers vide :
  src/lib/server/adapters/
  src/lib/types/
  src/lib/components/
  src/lib/utils/

Vérifie que `npm run dev` démarre sans erreur.
```

✅ **Vérification** : `npm run dev` → page par défaut SvelteKit visible sur `localhost:5173`

---

## Prompt 1 — Types et Interfaces

> 🏎️ **Gemini 3.8 Flash** · Crée: `src/lib/types/index.ts` · Dépend de: P0

```
Lis le fichier docs/DATA_MODEL.md et crée le fichier src/lib/types/index.ts avec TOUTES les interfaces et types du modèle de données.

Le fichier doit contenir :
- ProbeStatus (type union)
- Criticality (type union)
- NormalizedProbe (interface)
- NormalizedIncident (interface)
- DashboardState (interface)
- DashboardDelta (interface)
- SSEEventType (type)
- SSEEvent (type union discriminé)
- AdapterConfig (interface)
- MonitoringAdapter (interface)
- KatoConfig (interface)
- UptimeRobotConfig (interface)
- GridDensity (type union)
- Theme (type union)
- UserPreferences (interface)
- GridLayout (interface)

Chaque type/interface doit avoir des JSDoc comments en français.
Exporte tout avec `export`.
```

✅ **Vérification** : `npx tsc --noEmit` → 0 erreur

---

## Prompt 2 — Mock Adapter

> 🏎️ **Gemini 3.8 Flash** · Crée: `adapters/mock.adapter.ts` · Dépend de: P1

```
Crée l'adaptateur Mock dans src/lib/server/adapters/.

1. Crée src/lib/server/adapters/adapter.interface.ts qui ré-exporte l'interface MonitoringAdapter depuis les types.

2. Crée src/lib/server/adapters/mock.adapter.ts :
   - Implémente MonitoringAdapter
   - name = "mock"
   - initialize() : ne fait rien, résout immédiatement
   - fetchProbes() : génère des données de test réalistes
     - Accepte un paramètre optionnel `count` dans la config (défaut: 50)
     - Génère `count` sondes avec des noms réalistes (API Prod, DB Master, CDN Europe, etc.)
     - Distribution des statuts : ~90% up, ~3% degraded, ~2% down, ~3% paused, ~2% pending
     - Les statuts sont stables entre les appels (seed basé sur l'ID) mais changent de temps en temps (random ~5% de chance par cycle)
     - Response times entre 50 et 500ms
     - Uptime entre 95% et 100%
     - Groupes variés : "Production", "Staging", "Infrastructure", "APIs", "Sites Web"
     - Criticités variées
   - fetchIncidents(since) : génère quelques incidents cohérents avec les sondes DOWN
   - getPollingInterval() : retourne 5000 (5s pour le dev, plus réactif)

Réfère-toi à docs/DATA_MODEL.md pour les interfaces exactes.
Vérifie que le fichier compile sans erreur TypeScript.
```

✅ **Vérification** : `npx tsc --noEmit` → 0 erreur

---

## Prompt 3 — Store In-Memory + Poller

> ⚡ **Claude Sonnet 4.6 (Thinking)** · Crée: `store.ts`, `poller.ts`, `hooks.server.ts` · Dépend de: P1, P2

```
Crée le store in-memory et le service de polling.

Réfère-toi à docs/ARCHITECTURE.md pour le flux de données.

### src/lib/server/store.ts
- Singleton qui maintient l'état courant (DashboardState)
- Méthodes :
  - getState(): DashboardState
  - updateProbes(probes: NormalizedProbe[]): DashboardDelta | null
    → Compare avec l'état précédent, détecte les changements de statut
    → Retourne un DashboardDelta si quelque chose a changé, null sinon
    → Met à jour la liste d'incidents (rolling window 24h)
  - subscribe(callback: (delta: DashboardDelta) => void): () => void
    → Enregistre un listener, retourne une fonction unsubscribe
  - getIncidents(): NormalizedIncident[]

### src/lib/server/poller.ts
- Fonction startPolling(adapter: MonitoringAdapter, store: Store)
- Appelle adapter.fetchProbes() à intervalle régulier (adapter.getPollingInterval())
- Met à jour le store avec les résultats
- Gère les erreurs : log + continue (ne crash jamais)
- Retourne une fonction stop() pour arrêter le polling
- Log chaque cycle : "Polled {count} probes, {changes} changes"

### src/hooks.server.ts
- Au démarrage du serveur SvelteKit, initialise :
  1. Lit KATO_ADAPTER depuis process.env
  2. Crée l'adapter correspondant (mock pour l'instant)
  3. Appelle adapter.initialize()
  4. Crée le store
  5. Démarre le polling
  6. Stocke le store dans une variable accessible aux routes (module-level export ou global)
```

✅ **Vérification** : `npm run dev` → dans la console serveur, les logs "Polled X probes" apparaissent toutes les 5s

---

## Prompt 4 — Endpoint SSE

> ⚡ **Claude Sonnet 4.6 (Thinking)** · Crée: `api/events/+server.ts`, `sse-client.ts` · Dépend de: P3

```
Crée l'endpoint Server-Sent Events.

Réfère-toi à docs/ARCHITECTURE.md section "Couche 4: SSE Endpoint".

### src/routes/api/events/+server.ts

Crée un endpoint GET qui :
1. Retourne un Response avec Content-Type: text/event-stream
2. À la connexion, envoie immédiatement un événement `init` avec le DashboardState complet du store
3. S'abonne au store pour recevoir les deltas
4. À chaque delta, envoie un événement `update` avec le DashboardDelta
5. Envoie un `heartbeat` toutes les 15 secondes (pour garder la connexion vivante)
6. Nettoie l'abonnement quand le client se déconnecte

Format des événements SSE :
event: init
data: {"probes":[...],"incidents":[...],...}

event: update
data: {"changed":[...],"newIncidents":[...],...}

event: heartbeat
data: {"timestamp":"2026-01-01T00:00:00Z"}

Utilise ReadableStream pour créer le flux.
Assure-toi de gérer proprement la fermeture du stream (pas de memory leak).

### src/lib/utils/sse-client.ts

Crée un utilitaire côté client :
- Fonction connectSSE(onInit, onUpdate, onHeartbeat) 
- Utilise EventSource natif
- Parse les données JSON pour chaque type d'événement
- Gère la reconnexion automatique (natif EventSource)
- Retourne une fonction disconnect()

Vérifie que le endpoint fonctionne : npm run dev, puis curl http://localhost:5173/api/events
```

✅ **Vérification** : `curl -N http://localhost:5173/api/events` → reçoit `event: init` puis des `event: update` et `event: heartbeat`

---

## Prompt 5 — Grid Calculator

> 🏎️ **Gemini 3.8 Flash** · Crée: `grid-calculator.ts` · Dépend de: P1

```
Crée l'algorithme de calcul de grille adaptative.

Réfère-toi à docs/GRID_ALGORITHM.md pour l'algorithme complet et les seuils.

### src/lib/utils/grid-calculator.ts

Implémente la fonction calculateGrid(input: GridInput): GridLayout

L'algorithme doit :
1. Calculer l'aire disponible (viewport - header - incident bar)
2. Calculer la taille idéale de cellule : sqrt(aire / nbSondes)
3. Ajuster le gap selon la taille (12px, 8px, 6px, 4px)
4. Calculer colonnes = floor(largeur / (cellSize + gap))
5. Calculer lignes = ceil(nbSondes / colonnes)
6. Boucler pour réduire cellSize si tout ne tient pas en hauteur
7. Déterminer la densité : large (≥200px), medium (≥100px), compact (≥60px), micro (≥30px), pixel (<30px)

Exporte aussi une constante HEADER_HEIGHT = 48 et INCIDENT_BAR_HEIGHT = 40.

Ajoute des tests inline ou commentés qui vérifient les cas :
- 4 sondes sur 1920×1080 → large
- 50 sondes sur 1920×1080 → medium
- 200 sondes sur 1920×1080 → micro
```

✅ **Vérification** : `npx tsc --noEmit` → 0 erreur

---

## Prompt 6 — Composants ProbeCell et ProbeDot

> 🏎️ **Gemini 3.8 Flash** · Crée: `ProbeCell.svelte`, `ProbeDot.svelte`, `colors.ts` · Dépend de: P1, P5

```
Crée les composants d'affichage des sondes.

Réfère-toi à docs/UX_COMPONENTS.md pour les specs visuelles exactes et les classes Tailwind.
Réfère-toi à docs/COLORS_AND_THEME.md pour la palette de couleurs.

### src/lib/components/ProbeCell.svelte
- Props : probe (NormalizedProbe), density (GridDensity), cellSize (number)
- Le composant adapte son rendu selon la density :
  - 'large' : Carte complète avec nom, URL, uptime%, latence, icône statut
  - 'medium' : Carte moyenne avec nom, pastille, uptime%, latence
  - 'compact' : Carte compacte avec nom tronqué, bande couleur à gauche
- Animations : si probe.status === 'down', ajouter la classe animate-kato-pulse
- Glow : si down depuis > 1 minute, ajouter kato-glow-red
- Utilise les classes Tailwind de docs/UX_COMPONENTS.md

### src/lib/components/ProbeDot.svelte
- Props : probe (NormalizedProbe), density ('micro' | 'pixel'), cellSize (number)
- 'micro' : Cercle w-8 h-8 (ou adapté à cellSize) avec couleur de statut
- 'pixel' : Point w-4 h-4 avec couleur
- Tooltip au hover (utilise l'attribut title ou un tooltip custom)

### src/lib/utils/colors.ts
- Exporte une map STATUS_COLORS qui associe chaque ProbeStatus à :
  - bgClass (ex: 'bg-emerald-500')
  - textClass (ex: 'text-emerald-400')
  - cardBgClass pour le dark theme (ex: 'bg-emerald-900/30')
  - borderClass (ex: 'border-emerald-700/50')
- Fonction getStatusIcon(status: ProbeStatus): string → retourne le nom de l'icône Lucide
```

✅ **Vérification** : `npx tsc --noEmit` → 0 erreur

---

## Prompt 7 — Header et IncidentBar

> 🏎️ **Gemini 3.8 Flash** · Crée: `Header.svelte`, `IncidentBar.svelte` · Dépend de: P1

```
Crée les composants Header et IncidentBar.

Réfère-toi à docs/UX_COMPONENTS.md pour les specs détaillées.

### src/lib/components/Header.svelte
- Props : probes (NormalizedProbe[]), lastUpdate (string), compact (boolean)
- Affiche de gauche à droite :
  - Logo "KATO" (font-bold, tracking-wider)
  - Score global : "{up}/{total} UP" avec couleur adaptée (vert >95%, ambre >80%, rouge sinon)
  - Badges compteurs : un badge par statut avec icône + nombre (ex: 🟢 47)
    - Ne pas afficher les badges à 0 (sauf en mode non-compact)
  - Spacer flex-1
  - Horloge HH:MM:SS (mise à jour chaque seconde, font-mono)
  - Indicateur fraîcheur "↻ 12s" (vert <30s, ambre <60s, rouge >60s)
- Mode compact (prop compact=true) : h-8 au lieu de h-12, texte plus petit, seuls score + badges + horloge
- Responsive : sur mobile (<768px), masquer le logo et simplifier

### src/lib/components/IncidentBar.svelte
- Props : incidents (NormalizedIncident[]), tvMode (boolean)
- Bandeau fixe en bas (h-10)
- Si aucun incident actif : fond neutre, texte "✓ Aucun incident actif"
- Si incidents actifs : fond rouge (bg-red-950/80), liste des incidents
  - Chaque incident : pastille rouge + nom sonde + "DOWN depuis Xm Ys"
  - En mode TV : les incidents défilent horizontalement (animation CSS marquee)
  - En mode desktop : affichés en ligne, scroll horizontal si débordement
- La durée se met à jour en temps réel (compteur qui s'incrémente)
```

✅ **Vérification** : `npx tsc --noEmit` → 0 erreur

---

## Prompt 8 — Page Dashboard Principale

> 🧠 **Claude Opus 4.6 (Thinking)** · Crée: `+page.svelte`, `+page.server.ts`, `+layout.svelte` · Dépend de: P4, P5, P6, P7
>
> ⚠️ **C'est le prompt le plus critique — utilise `/goal` pour qu'Opus ne s'arrête pas avant d'avoir fini.**

```
Assemble tous les composants dans la page principale.

### src/routes/+layout.svelte
- Layout minimal : <slot /> plein écran
- Applique le thème (data-theme sur <html>)
- Tailwind base classes : bg-slate-950 text-white min-h-screen

### src/routes/+page.svelte
- C'est LA page du dashboard, le cœur de l'application
- Au mount :
  1. Se connecte au SSE via sse-client.ts
  2. Reçoit l'événement init → stocke le DashboardState dans un $state
  3. À chaque update → applique le DashboardDelta au state local
  4. À chaque heartbeat → met à jour le timestamp de dernière MAJ
- Utilise grid-calculator.ts pour calculer la GridLayout
  - Inputs : taille du viewport (ResizeObserver), nombre de sondes
  - Recalcule à chaque resize (debounced 150ms) et quand le nombre de sondes change
- Affiche :
  1. <Header> en haut
  2. <ProbeGrid> au centre → itère sur les sondes triées
     - Tri intelligent : DOWN first, puis DEGRADED, puis UP (par criticité), puis PAUSED
     - Selon la density du GridLayout, rend ProbeCell ou ProbeDot
  3. <IncidentBar> en bas avec les incidents actifs

- Détecte le paramètre URL ?tv=1 pour le mode TV (sera implémenté au prompt 12)
- Le container de la grille a un overflow:hidden et prend tout l'espace restant

### src/routes/+page.server.ts
- Load function qui récupère l'état initial du store (pour le SSR)
- Retourne { initialState: store.getState() }

Vérifie : lance npm run dev, ouvre le navigateur, tu dois voir la grille de sondes mock avec le header et l'incident bar.
```

✅ **Vérification** : `npm run dev` → dashboard complet visible avec ~50 sondes mock, header avec score, barre d'incidents en bas

---

## Prompt 9 — Adaptateur Uptime Robot

> ⚡ **Claude Sonnet 4.6 (Thinking)** · Crée: `uptime-robot.adapter.ts` · Dépend de: P3

```
Crée l'adaptateur Uptime Robot en te basant sur docs/UPTIME_ROBOT_API.md.

### src/lib/server/adapters/uptime-robot.adapter.ts

Implémente MonitoringAdapter :

1. name = "uptimerobot"

2. initialize(config) :
   - Lit l'API key depuis config.apiKey (venant de process.env.UPTIMEROBOT_API_KEY)
   - Vérifie que la clé est présente (throw si manquante)
   - Fait un appel test GET /monitors?per_page=1 pour valider la clé
   - Log le nombre total de monitors trouvés

3. fetchProbes() :
   - Appelle GET /monitors avec pagination cursor-based
   - Boucle tant que has_more === true
   - Pour chaque monitor, transforme en NormalizedProbe :
     - id : "ur:{monitor.id}"
     - source : "uptimerobot"
     - name : monitor.friendly_name
     - url : monitor.url
     - status : mapping (0→paused, 1→pending, 2→up, 8→degraded, 9→down)
     - responseTime : null (phase 2)
     - uptime24h : null (phase 2)
     - uptime7d : null (phase 2)
     - lastCheck : now (ISO 8601)
     - group : extraire depuis le nom si pattern "[Group] Name" sinon null
     - criticality : "medium" par défaut

4. fetchIncidents(since) :
   - Pour chaque monitor actuellement DOWN, créer un NormalizedIncident
   - Ne PAS appeler les logs individuels à chaque poll (trop de requêtes)
   - Garder en mémoire la date de début de chaque incident

5. getPollingInterval() :
   - Retourne process.env.UPTIMEROBOT_POLL_INTERVAL ou 30000

Gestion des erreurs :
- 401 → log "API key invalide", ne pas crasher
- 429 → backoff exponentiel (60s, 120s, 240s)
- Timeout >10s → retry 1 fois puis skip
- Réseau down → garder dernier état, log warning

### Mise à jour de hooks.server.ts
- Ajouter la logique pour choisir l'adapter selon KATO_ADAPTER
- Si "uptimerobot" : instancier UptimeRobotAdapter avec la config
- Si "mock" : instancier MockAdapter
```

✅ **Vérification** : change `.env` en `KATO_ADAPTER=uptimerobot` avec une vraie clé → les monitors apparaissent

---

## Prompt 10 — Animations d'Alerte

> 🏎️ **Gemini 3.8 Flash** · Modifie: `app.css`, `ProbeCell.svelte`, `+page.svelte` · Dépend de: P6, P8

```
Implémente les animations d'alerte.

Réfère-toi à docs/COLORS_AND_THEME.md pour les keyframes exacts.

### src/app.css
Ajoute les keyframes et classes d'animation personnalisées :
- @keyframes kato-pulse (scale + opacity pour les sondes DOWN)
- @keyframes kato-border-flash (flash bordure lors transition UP→DOWN)
- @keyframes kato-marquee (défilement texte incident bar en mode TV)
- @keyframes kato-drift (anti burn-in, déplacement lent)
- Classe .kato-glow-red (box-shadow pour DOWN > 1min)
- Gère @media (prefers-reduced-motion: reduce) → désactive tout

### Mise à jour de ProbeCell.svelte et ProbeDot.svelte
- Ajoute une prop prevStatus (optionnel) pour détecter les transitions
- Si status === 'down' : appliquer animate-kato-pulse
- Si status === 'down' ET downSince > 60s : ajouter kato-glow-red
- Si transition de 'up' vers 'down' : appliquer animate-kato-border-flash pendant 2s

### Mise à jour de +page.svelte
- Quand ≥ 30% des sondes sont DOWN : le fond du body passe à bg-red-950/20
- Quand une transition UP→DOWN se produit : flash sur la bordure du container principal
- Tracker les statuts précédents pour détecter les transitions

### Mise à jour de tailwind.config.ts (ou app.css via @theme)
- Ajouter les animations custom dans la config Tailwind si nécessaire
```

✅ **Vérification** : les sondes DOWN pulsent en rouge, les transitions sont visibles

---

## Prompt 11 — Auth Simple

> 🏎️ **Gemini 3.8 Flash** · Crée: `auth.ts`, `login/+page.svelte` · Dépend de: P3

```
Implémente l'authentification par mot de passe.

### src/lib/server/auth.ts
- Fonction hashPassword(password: string): string → utilise bcrypt ou crypto.scrypt natif
- Fonction verifyPassword(input: string, hash: string): boolean
- Au démarrage, le mot de passe de KATO_AUTH_PASSWORD est hashé une fois

### src/hooks.server.ts (mise à jour)
- Si KATO_AUTH_ENABLED=true :
  - Vérifie la présence d'un cookie "kato-session" sur chaque requête
  - Si absent et la route n'est pas /login → redirect vers /login
  - Le cookie contient un token aléatoire (crypto.randomUUID)
  - Le token est validé contre un Set en mémoire

### src/routes/login/+page.svelte
- Page de login minimaliste
- Réfère-toi à docs/UX_COMPONENTS.md section LoginForm pour le design
- Un seul champ : mot de passe
- Submit → POST /login
- Si succès → redirect vers /
- Si erreur → affiche "Mot de passe incorrect" en rouge

### src/routes/login/+page.server.ts
- Action de form (SvelteKit form actions)
- Vérifie le mot de passe
- Si correct : crée une session (cookie HTTP-only, SameSite=Strict, maxAge=30j)
- Si incorrect : retourne { error: true }

### L'endpoint SSE /api/events doit aussi vérifier l'auth si activée.
```

✅ **Vérification** : `KATO_AUTH_ENABLED=true` → redirige vers `/login`, mot de passe correct → accès au dashboard

---

## Prompt 12 — Mode TV

> ⚡ **Claude Sonnet 4.6 (Thinking)** · Crée: `tv-mode.ts` · Dépend de: P8

```
Implémente le mode TV pour affichage permanent sur écran.

### src/lib/utils/tv-mode.ts
Crée un module qui gère le mode TV :
- Fonction enterTvMode() :
  - document.documentElement.requestFullscreen()
  - Démarre le timer curseur (cache après 5s d'inactivité via cursor:none)
  - Démarre le timer anti burn-in (drift ±3px toutes les 10min)
    → utilise l'animation CSS kato-drift de docs/COLORS_AND_THEME.md
  - Optionnel : Wake Lock API (navigator.wakeLock.request('screen'))
- Fonction exitTvMode() :
  - document.exitFullscreen()
  - Restaure le curseur
  - Arrête le drift
  - Libère le wake lock
- Détection d'inactivité : si pas de mousemove/keypress pendant 30s → auto-enter

### Mise à jour de +page.svelte
- Lit le paramètre URL ?tv=1 via $page.url.searchParams
- Si tv=1 : appelle enterTvMode() au mount
- En mode TV :
  - Le Header passe en mode compact (h-8)
  - L'IncidentBar passe en mode marquee (défilement auto des incidents)
  - Pas d'interaction possible (tooltips au hover uniquement, pas de clic)
- Ajoute un listener keypress 'Escape' pour quitter le mode TV

Vérifie : ouvre http://localhost:5173/?tv=1, l'écran doit passer en fullscreen avec curseur masqué.
```

✅ **Vérification** : `?tv=1` → fullscreen, curseur disparaît, incidents défilent

---

## Prompt 13 — Responsive Mobile

> 🏎️ **Gemini 3.8 Flash** · Modifie: plusieurs composants · Dépend de: P6, P7, P8

```
Adapte le dashboard pour mobile.

### Modifications de +page.svelte
- Détecte la largeur du viewport
- Si < 768px (mobile) :
  - Le container de grille autorise overflow-y: auto (scroll vertical)
  - Taille minimum de cellule : 44px (guidelines tactiles Apple/Google)
  - Le grid-calculator respecte cette contrainte
  - Pull-to-refresh natif : écoute le geste et force un re-fetch

### Modifications de Header.svelte
- < 768px : masquer le logo, réduire les badges, horloge simplifiée (HH:MM)
- < 480px : ne garder que le score global et l'horloge

### Modifications de IncidentBar.svelte
- Sur mobile : la barre devient un bandeau expandable (tap pour voir les détails)
- Hauteur réduite quand fermé (h-8), liste déroulante quand ouvert

### Modifications de ProbeCell.svelte
- Sur mobile, la vue détail s'ouvre en modal fullscreen au tap (pas de tooltip hover)
- Ajoute un événement on:click qui dispatch un event 'probe-detail'

### Nouveau : src/lib/components/DetailModal.svelte
- Modal fullscreen sur mobile, side-panel sur desktop
- Affiche : nom, URL, statut, response time, uptime 24h/7d
- Bouton fermer
- Design : réfère-toi à docs/UX_COMPONENTS.md section Vue Détail
```

✅ **Vérification** : DevTools responsive 375px → grille scrollable, cellules ≥ 44px, tap ouvre le détail

---

## Prompt 14 — Système de Thèmes

> 🏎️ **Gemini 3.8 Flash** · Crée: `theme.ts` · Dépend de: P6, P8

```
Implémente le système de thèmes complet.

Réfère-toi à docs/COLORS_AND_THEME.md pour les CSS custom properties et les palettes.

### src/app.css
Ajoute les CSS custom properties pour les 3 thèmes :
- :root, [data-theme='dark'] → fond #0F172A
- [data-theme='light'] → fond #F8FAFC
- [data-theme='amoled'] → fond #000000

### src/lib/utils/theme.ts
- Fonction getInitialTheme(): Theme
  → Lit depuis localStorage('kato-theme')
  → Si 'auto' : utilise window.matchMedia('(prefers-color-scheme: dark)')
  → Défaut : 'dark'
- Fonction applyTheme(theme: Theme): void
  → Set data-theme sur <html>
  → Sauvegarde dans localStorage
- Écoute les changements de prefers-color-scheme si mode 'auto'

### Mise à jour de +layout.svelte
- Au mount : appelle getInitialTheme() et applyTheme()
- Réagit aux changements de thème

### Mise à jour de ProbeCell.svelte et ProbeDot.svelte
- Utilise les CSS custom properties pour les fonds de cellules
- En AMOLED : fond noir pur avec bordure colorée uniquement

### Optionnel : mini bouton settings dans le Header
- Icône engrenage dans le coin droit
- Dropdown avec sélecteur de thème (dark/light/amoled/auto)
- Sauvegardé en localStorage
```

✅ **Vérification** : changer de thème dans le sélecteur → les couleurs changent, rechargement → le thème est conservé

---

## Prompt 15 — Notifications Sonores (Optionnel)

> 🏎️ **Gemini 3.8 Flash** · Crée: `sounds.ts` · Dépend de: P8

```
Ajoute les notifications sonores optionnelles.

### src/lib/utils/sounds.ts
- Utilise l'API Web Audio pour générer des sons simples (pas de fichiers audio)
- Fonction playBeep(frequency: number, duration: number)
  → Crée un OscillatorNode + GainNode
  → Joue le son avec un fade-out propre
- Fonction playAlertDown() → beep aigu (880Hz, 200ms)
- Fonction playAlertRecovery() → double beep grave (440Hz, 100ms × 2)
- Fonction playAlertCritical() → séquence de 3 beeps (880Hz)
- Variable globale soundEnabled (lue depuis localStorage)

### Mise à jour de +page.svelte
- Quand un delta contient un changement UP→DOWN : playAlertDown()
- Quand un delta contient un changement DOWN→UP : playAlertRecovery()
- Quand ≥ 3 sondes passent DOWN simultanément : playAlertCritical()
- Respecter soundEnabled (vérifié dans localStorage)
- Note : le son ne peut jouer qu'après une interaction utilisateur (politique navigateur)
  → En mode TV, les sons peuvent nécessiter un clic initial

### Mini toggle dans le Header pour activer/désactiver le son (icône 🔊/🔇)
```

✅ **Vérification** : activer le son, attendre qu'une sonde mock change de statut → beep audible

---

## Prompt 16 — Polish Final et Vérification

> 🧠 **Claude Opus 4.6 (Thinking)** · Audit global · Dépend de: tout
>
> ⚠️ **Utilise `/goal` pour que l'agent soit exhaustif.**

```
Fais un audit complet du projet et corrige les problèmes.

### Vérifications :

1. **TypeScript** : lance npx tsc --noEmit et corrige toutes les erreurs de type

2. **Build** : lance npm run build et vérifie que ça compile sans erreur

3. **Performance** : 
   - Vérifie qu'il n'y a pas de memory leak dans le SSE (abonnements nettoyés)
   - Vérifie qu'il n'y a pas de setInterval non nettoyé
   - Vérifie que le ResizeObserver est déconnecté au unmount

4. **Accessibilité** :
   - Vérifie les contrastes WCAG AA sur tous les thèmes
   - Ajoute les attributs ARIA manquants (role, aria-label, aria-live)
   - La barre d'incidents doit avoir aria-live="polite"
   - Les badges de compteurs doivent avoir des aria-label descriptifs

5. **Mode TV** : teste avec ?tv=1
   - Le fullscreen fonctionne
   - Le curseur se cache
   - L'anti burn-in fonctionne
   - Les incidents défilent

6. **Mobile** : teste en responsive (DevTools)
   - La grille s'adapte
   - Le scroll vertical fonctionne
   - Les cellules font minimum 44px
   - Le tap ouvre le détail

7. **Graceful degradation** :
   - Coupe le serveur mock → le dashboard doit afficher "Connexion perdue" et retenter
   - L'indicateur de fraîcheur doit passer en rouge

8. **Crée un README.md** à la racine du projet avec :
   - Description du projet
   - Screenshot (placeholder)
   - Instructions d'installation
   - Configuration (.env)
   - Modes d'utilisation (desktop, TV, mobile)
   - Architecture simplifiée
   - Comment ajouter un nouvel adapter
```

✅ **Vérification** : `npm run build` → 0 erreur, l'application tourne proprement sur tous les modes

---

## 📊 Résumé Visuel

```
  P0 Init ──► P1 Types ──┬──► P2 Mock ──► P3 Store ──► P4 SSE ──┐
              🏎️ Flash    │    🏎️ Flash    ⚡ Sonnet    ⚡ Sonnet  │
                          │                     │                 │
                          ├──► P5 Grid ──────────┤                 │
                          │    🏎️ Flash          │                 │
                          │                     │                 │
                          ├──► P6 Cells ─────────┤                 │
                          │    🏎️ Flash          │                 │
                          │                     │                 │
                          └──► P7 Header ────────┘                 │
                               🏎️ Flash                           │
                                                                  │
                              P8 Dashboard ◄──────────────────────┘
                              🧠 OPUS  (/goal)
                                    │
                    ┌───────┬───────┼───────┬───────┬───────┐
                    ▼       ▼       ▼       ▼       ▼       ▼
                  P9 UR   P10     P11     P12     P13     P14    P15
                  ⚡Son   🏎️Fl   🏎️Fl   ⚡Son   🏎️Fl   🏎️Fl   🏎️Fl
                    │       │       │       │       │       │       │
                    └───────┴───────┴───────┴───────┴───────┴───────┘
                                           │
                                           ▼
                                    P16 Polish
                                    🧠 OPUS  (/goal)
```
