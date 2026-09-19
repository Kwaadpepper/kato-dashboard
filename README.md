# Kato — Wallboard High-Density Monitoring

> **Kato** est un dashboard de supervision haute densité conçu pour afficher de 1 à plus de 200 sondes en temps réel avec **zéro défilement** sur écran desktop et TV. Il agrège les données d'APIs de monitoring tierces (UptimeRobot, etc.) via un serveur BFF (Backend-For-Frontend) et les diffuse au navigateur en Server-Sent Events (SSE).

---

## 📸 Aperçu

```text
+-----------------------------------------------------------------------------------+
| KATO   198/200 UP   [🟢 198] [🟡 1] [🔴 1] [⚪ 0]                   13:45:12   ↻ 4s 🔊 🌙 |
+-----------------------------------------------------------------------------------+
| +--------------+ +--------------+ +--------------+ +--------------+ +------------+ |
| | API Gateway  | | Auth Service | | DB Primary   | | CDN Edge     | | Worker #1  | |
| | 99.98%  24ms | | 100%    18ms | | DOWN   0ms   | | 99.99%  12ms | | 100%  32ms | |
| +--------------+ +--------------+ +--------------+ +--------------+ +------------+ |
| +--------------+ +--------------+ +--------------+ +--------------+ +------------+ |
| | Worker #2    | | Redis Cache  | | Search Index | | Mailer Queue | | S3 Storage | |
| | 100%    28ms | | 99.95%   8ms | | DEGRADED 180m| | 100%    45ms | | 100%  95ms | |
| +--------------+ +--------------+ +--------------+ +--------------+ +------------+ |
+-----------------------------------------------------------------------------------+
| 🔴 Incidents (2) : DB Primary DOWN (3m 12s)  •  Search Index DEGRADED (12m 45s)   |
+-----------------------------------------------------------------------------------+
```

*(Placeholder screenshot : capture d'écran du wallboard en mode sombre avec 200 sondes)*

---

## ✨ Fonctionnalités clés

- **Zéro scroll garanti (Desktop)** : Algorithme de grille adaptatif calculant les dimensions optimales (lignes, colonnes, gap, densité) pour occuper 100% de l'espace disponible sans défilement.
- **5 niveaux de densité visuelle** :
  - `large` (1 à 12 sondes) : Cartes détaillées avec nom, URL, uptime 24h, latence.
  - `medium` (13 à 48 sondes) : Cartes intermédiaires compactes.
  - `compact` (49 à 120 sondes) : Lignes synthétiques avec jauge et temps de réponse.
  - `micro` (121 à 300 sondes) : Micro-pastilles carrées/circulaires avec tooltip contextuel.
  - `pixel` (> 300 sondes) : Grille ultra-dense façon heatmap.
- **Flux temps réel SSE (Server-Sent Events)** : Communication unidirectionnelle push serveur → client (`init`, `update` deltas, `heartbeat` 15s). Aucune latence, reconnexion automatique.
- **Tri prioritaire intelligent** : Les sondes critiques (`DOWN`) s'affichent immédiatement en haut à gauche, suivies des états `DEGRADED`, puis des sondes saines triées par criticité et latence.
- **Mode TV / Wallboard (`?tv=1`)** : Plein écran automatique, masquage du curseur après 5s d'inactivité, anti burn-in par micro-dérive périodique (drift ±3px / 10min), défilement horizontal continu des incidents (*marquee*).
- **Accessibilité & Thèmes (WCAG AA)** : Support des modes Sombre (*Dark*), Clair (*Light*), et Noir pur (*AMOLED/OLED*). Ratios de contraste strictement supérieurs à 4.5:1 sur chaque thème.
- **Dégradation gracieuse** : En cas d'interruption serveur ou réseau, bannière « Connexion perdue », indicateur de fraîcheur virant au rouge, et réessais automatiques avec réconciliation de snapshot à la reconnexion.

---

## 🛠️ Stack Technique

- **Framework** : SvelteKit 2 (Svelte 5 avec Runes `$state`, `$derived`, `$effect`)
- **Adaptateur** : `@sveltejs/adapter-node`
- **CSS** : Tailwind CSS v4 + PostCSS
- **Langage** : TypeScript strict
- **Temps réel** : SSE (`EventSource`) natif
- **Icônes** : Lucide Icons (`lucide-svelte`)
- **Stockage** : Mémoire vive (*in-memory* singleton store, restart = reset)

---

## 🚀 Installation & Démarrage

### Prérequis

- Node.js 20+ ou supérieur
- npm 10+

### Installation

```bash
# Cloner le dépôt
git clone https://github.com/votre-orga/kato-dashboard.git
cd kato-dashboard

# Installer les dépendances
npm install

# Copier le fichier d'environnement
cp .env.example .env
```

### Démarrage en développement

```bash
npm run dev
```

L'application est accessible sur `http://localhost:5173`.

### Compilation et exécution de production

```bash
# Build de production
npm run build

# Lancement du serveur Node de production
node build
```

---

## ⚙️ Configuration (.env)

Les variables d'environnement suivantes permettent de paramétrer Kato :

| Variable | Type | Valeur par défaut | Description |
| :--- | :---: | :---: | :--- |
| `KATO_ADAPTER` | `string` | `mock` | Adaptateur de supervision actif (`mock` ou `uptimerobot`). |
| `KATO_MOCK_COUNT` | `number` | `50` | Nombre de sondes générées en mode mock. |
| `KATO_AUTH_ENABLED` | `boolean` | `false` | Activer la protection de l'interface par mot de passe. |
| `KATO_AUTH_PASSWORD` | `string` | `changeme` | Mot de passe d'accès requis si l'authentification est activée. |
| `UPTIMEROBOT_API_KEY` | `string` | *(vide)* | Clé API UptimeRobot v3 (en lecture seule recommandée). |
| `UPTIMEROBOT_POLL_INTERVAL`| `number` | `30000` | Intervalle de polling côté serveur en ms (défaut : 30s). |
| `PORT` | `number` | `3000` | Port d'écoute du serveur Node.js en production. |
| `HOST` | `string` | `0.0.0.0` | Interface réseau d'écoute. |

---

## 📱 Modes d'utilisation

### 1. Mode Desktop (Wallboard standard)
Accédez à l'URL racine `http://localhost:3000/`.
- Adaptation géométrique instantanée de la grille au conteneur avec ResizeObserver debouncé.
- Clic sur une sonde pour afficher le volet latéral d'informations détaillées (latence, disponibilité 24h/7j, criticité, métadonnées).
- Sélecteur de thème (Sombre, Clair, AMOLED, Auto) et bouton de contrôle des alertes audio.

### 2. Mode TV / Écran mural 24/7 (`?tv=1`)
Ajoutez `?tv=1` à l'URL : `http://localhost:3000/?tv=1`
- **Plein écran** automatique (`requestFullscreen`) avec déblocage au premier geste utilisateur si requis par la politique du navigateur.
- **Curseur masqué** automatiquement après 5 secondes d'inactivité.
- **Protection anti marquage (Burn-in)** : Dérive lente et imperceptible de ±3px toutes les 10 minutes (`animate-kato-drift`).
- **Incidents défilants** : En mode TV, la barre d'incidents défile horizontalement en boucle continue (*marquee*).
- **Maintien actif de l'écran** : Screen Wake Lock API active empêchant la mise en veille.
- Sortie du mode TV via la touche `Escape`.

### 3. Mode Mobile / Tactile
Ouvrez le dashboard sur un appareil mobile (`viewport < 768px`) :
- Grille responsive avec défilement vertical fluide (`overflow-y-auto`).
- **Cible tactile minimale garantie de 44px** pour chaque sonde (respect des directives Apple HIG et Google Material).
- Tap sur une sonde pour ouvrir la modale plein écran.
- **Geste tactile Pull-to-Refresh** : tirez vers le bas pour forcer l'actualisation instantanée du parc.

---

## 🏗️ Architecture Simplifiée

```text
┌─────────────────────────────────────────────────────────────┐
│                    FOURNISSEURS TIERS                       │
│       UptimeRobot API v3   /   Autres services de ping      │
└─────────────────────────────┬───────────────────────────────┘
                              │ Polling HTTP serveur (BFF)
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      SERVEUR SVELTEKIT                      │
│                                                             │
│   src/lib/server/adapters/                                  │
│   ├── mock.adapter.ts                                       │
│   └── uptime-robot.adapter.ts                               │
│                                                             │
│   src/lib/server/poller.ts (boucle récurrente)              │
│                │                                            │
│                ▼                                            │
│   src/lib/server/store.ts (Singleton RAM)                   │
│   ├── Map<string, NormalizedProbe>                          │
│   ├── Map<string, NormalizedIncident> (fenêtre 24h)         │
│   └── Calcul différentiel (DashboardDelta)                  │
│                │                                            │
│                ▼                                            │
│   src/routes/api/events/+server.ts                          │
│   └── Flux SSE : init (snapshot), update (deltas), heartbeat│
└─────────────────────────────┬───────────────────────────────┘
                              │ Flux text/event-stream (SSE)
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     CLIENT NAVIGATEUR                       │
│                                                             │
│   src/lib/utils/sse-client.ts (EventSource + auto-reconnect)│
│   src/lib/utils/grid-calculator.ts (Géométrie zéro scroll)  │
│   src/routes/+page.svelte (Orchestration Svelte 5 Runes)    │
│                                                             │
│   src/lib/components/                                       │
│   ├── Header.svelte (Score, badges ARIA, fraîcheur, thème)  │
│   ├── ProbeGrid.svelte (CSS Grid dynamique + FLIP animate)  │
│   ├── ProbeCell.svelte / ProbeDot.svelte                    │
│   ├── IncidentBar.svelte (aria-live="polite", marquee TV)   │
│   └── DetailModal.svelte (Volet détaillé)                   │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔌 Comment ajouter un nouvel adaptateur

Le projet utilise l'Adapter Pattern pour découpler les sources de supervision du reste de l'application. Pour intégrer un nouveau service (ex: Pingdom, BetterUptime, Datadog, Prometheus) :

### Étape 1 : Créer le fichier d'adaptateur
Créez un nouveau fichier `src/lib/server/adapters/mon-service.adapter.ts` implémentant l'interface `MonitoringAdapter` :

```typescript
import type {
    MonitoringAdapter,
    AdapterConfig,
    NormalizedProbe,
    NormalizedIncident
} from '$lib/types';

export class MonServiceAdapter implements MonitoringAdapter {
    readonly name = 'monservice';
    private apiKey = '';
    private pollIntervalMs = 30000;

    async initialize(config: AdapterConfig): Promise<void> {
        this.apiKey = (config.apiKey as string) ?? '';
        this.pollIntervalMs = (config.pollInterval as number) ?? 30000;
    }

    async fetchProbes(): Promise<NormalizedProbe[]> {
        // 1. Appel HTTP vers l'API de votre fournisseur
        const res = await fetch('https://api.monservice.com/v1/checks', {
            headers: { Authorization: `Bearer ${this.apiKey}` }
        });
        const data = await res.json();

        // 2. Transformation vers le format normalisé NormalizedProbe
        return data.checks.map((item: any) => ({
            id: String(item.id),
            name: item.name,
            url: item.target_url ?? null,
            status: item.is_up ? 'up' : 'down', // 'up' | 'down' | 'degraded' | 'paused' | 'pending' | 'maintenance'
            responseTime: item.last_latency_ms ?? null,
            uptime24h: item.uptime_1d ?? 100,
            uptime7d: item.uptime_7d ?? 100,
            criticality: 'critical',
            lastCheck: new Date().toISOString(),
            group: item.category ?? null,
            source: this.name
        }));
    }

    async fetchIncidents(since: Date): Promise<NormalizedIncident[]> {
        return []; // Optionnel : retournez les incidents si supportés par l'API
    }

    getPollingInterval(): number {
        return this.pollIntervalMs;
    }
}
```

### Étape 2 : Enregistrer l'adaptateur dans `src/hooks.server.ts`
Ajoutez la prise en charge de votre adaptateur dans la fonction `bootstrap()` :

```typescript
if (adapterType === 'uptimerobot') {
    adapter = new UptimeRobotAdapter();
    // ...
} else if (adapterType === 'monservice') {
    adapter = new MonServiceAdapter();
    await adapter.initialize({
        apiKey: process.env.MON_SERVICE_API_KEY,
        pollInterval: 30000
    });
} else {
    adapter = new MockAdapter();
    // ...
}
```

### Étape 3 : Configurer l'environnement
Définissez dans votre `.env` :
```env
KATO_ADAPTER=monservice
MON_SERVICE_API_KEY=votre_cle_api_secrete
```

---

## 🧪 Tests & Qualité

```bash
# Vérification des types TypeScript
npx tsc --noEmit

# Vérification des composants Svelte
npm run check

# Exécution de la suite de tests unitaires (Node test runner)
npm test

# Build de production complet
npm run build
```

---

## 📄 Licence

MIT © Jeremy — Projet Kato Dashboard.
