# Kato — High-Density Monitoring Wallboard

> **Kato** is a real-time, high-density monitoring dashboard engineered to visualize anywhere from 1 to 200+ probes on a single screen with **zero scrolling** on desktop and TV wallboards. It aggregates third-party monitoring services (such as UptimeRobot and UptimeKuma) through a lightweight SvelteKit BFF (Backend-For-Frontend) and pushes differential updates to client browsers using native Server-Sent Events (SSE).

---

## 📸 Preview

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

---

## ✨ Key Features

- **Guaranteed Zero-Scroll (Desktop & TV)**: Proprietary adaptive grid algorithm dynamically computes cell geometries, rows, columns, gaps, and density tiers to fit 100% of the viewport without vertical or horizontal scrollbars.
- **5 Progressive Density Modes**:
  - `large` (1–12 probes): Detailed cards featuring name, target URL, 24h uptime, and latency sparklines.
  - `medium` (13–48 probes): Compact cards balancing information density and readability.
  - `compact` (49–120 probes): Condensed rows with status badges and response times.
  - `micro` (121–300 probes): High-density status dots with instant contextual tooltips.
  - `pixel` (> 300 probes): Ultra-dense heatmap matrix.
- **Server-Sent Events (SSE) Real-Time Stream**: Unidirectional HTTP event stream (`init` full snapshot, `update` fine-grained deltas, `heartbeat` every 15s) with automatic reconnection and state reconciliation.
- **Intelligent Prioritization**: Probes experiencing outages (`DOWN`) are automatically promoted to the top-left, followed by `DEGRADED` monitors, healthy monitors sorted by criticality, and alphabetical sorting.
- **24/7 TV & Wallboard Mode (`?tv=1`)**: Automatic fullscreen (`requestFullscreen`), cursor auto-hiding after 5 seconds of inactivity, periodic anti burn-in drift (±3px every 10 min), Screen Wake Lock integration, and continuous incident marquee ticker.
- **Accessibility & Design Themes (WCAG AA)**: Fully accessible with high-contrast themes (**Dark**, **Light**, **AMOLED / Pure Black**, **Auto**). Full keyboard navigation (2D grid arrow keys, `Home`, `End`, `PageUp`, `PageDown`), screen reader live regions (`aria-live`), and skip links.
- **Multilingual Support**: Fully internationalized in **English** (default) and **French** with runtime switching and persistence.
- **Zero Database / Zero Bloat**: 100% in-memory architecture. Restarting the server performs a fast clean re-sync with third-party providers.

---

## 🛠️ Tech Stack

- **Framework**: [SvelteKit 2](https://kit.svelte.dev/) with **Svelte 5** (modern Runes: `$state`, `$derived`, `$effect`)
- **Server Adapter**: `@sveltejs/adapter-node` (standalone persistent Node.js service)
- **Styling**: Tailwind CSS v4 + PostCSS
- **Language**: TypeScript (strict mode enabled across client and server)
- **Real-Time Delivery**: Native Server-Sent Events (`EventSource`)
- **Icons**: Lucide Icons (`lucide-svelte`)
- **Persistence**: In-memory singleton store with rolling 24-hour incident buffer

---

## 🚀 Quick Start

### Prerequisites

- Node.js 20.x or higher
- npm 10.x or higher

### Installation

```bash
# Clone the repository
git clone https://github.com/Kwaadpepper/kato-dashboard.git
cd kato-dashboard

# Install dependencies
npm install

# Create environment configuration
cp .env.example .env
```

### 🐳 Docker (recommended)

The easiest way to run Kato — no Node.js required:

```bash
# Copy and edit configuration
cp .env.example .env

# Pull the pre-built image and start
docker compose up -d
```

The app will be available at `http://localhost:3000`.

> To build the image locally instead of pulling from the registry, replace `image:` with `build: .` in `docker-compose.yml`.

Published image: `ghcr.io/kwaadpepper/kato-dashboard:latest`

### Development Server

```bash
npm run dev
```

Open `http://localhost:5173` in your browser.

### Production Build & Run

```bash
# Compile and build bundle
npm run build

# Start production Node.js server
node build
```

The application will be accessible at `http://localhost:3000` (or your configured `PORT`).

---

## ⚙️ Configuration (`.env`)

Configure your installation using environment variables:

| Variable                     |   Type    |  Default   | Description                                                       |
| :--------------------------- | :-------: | :--------: | :---------------------------------------------------------------- |
| `KATO_ADAPTER`               | `string`  |   `mock`   | Active monitoring provider (`mock`, `uptimerobot`, or `uptimekuma`). |
| `KATO_MOCK_COUNT`            | `number`  |    `50`    | Total number of simulated probes in mock mode.                    |
| `KATO_AUTH_ENABLED`          | `boolean` |  `false`   | Enable password protection for dashboard access.                  |
| `KATO_AUTH_PASSWORD`         | `string`  | `changeme` | Required password if authentication is enabled.                   |
| `KATO_DEFAULT_LOCALE`        | `string`  |    `en`    | Default UI language (`en` or `fr`).                               |
| `KATO_DEFAULT_THEME`         | `string`  |   `dark`   | Initial color theme (`dark`, `light`, `amoled`, `auto`).          |
| `KATO_DEFAULT_TIME_FORMAT`   | `string`  |   `24h`    | Clock display format (`24h` or `12h`).                            |
| `KATO_DEFAULT_TIME_ZONE`     | `string`  |  `local`   | Clock timezone (`local` or IANA like `UTC`, `Europe/Paris`).      |
| `KATO_DEFAULT_SHOW_SECONDS`  | `boolean` |   `true`   | Show or hide seconds in header clock.                             |
| `KATO_DEFAULT_SOUND_ENABLED` | `boolean` |  `false`   | Enable sound chime alerts for state transitions.                  |
| `KATO_DEFAULT_MARQUEE_SPEED` | `string`  |   `slow`   | Ticker speed preset (`slow`, `normal`, `fast`).                   |
| `KATO_DEFAULT_SORT_MODE`     | `string`  |  `smart`   | Grid sort order (`smart`, `status`, `alpha`, `latency`, `group`). |
| `UPTIMEROBOT_API_KEY`        | `string`  |    `""`    | UptimeRobot v3 API read-only token.                               |
| `UPTIMEROBOT_POLL_INTERVAL`  | `number`  |  `30000`   | UptimeRobot polling interval in milliseconds.                     |
| `UPTIME_KUMA_URL`            | `string`  |    `""`    | Base URL of your UptimeKuma instance (e.g. `https://kuma.example.com`). |
| `UPTIME_KUMA_API_KEY`        | `string`  |    `""`    | UptimeKuma API key (Basic Auth password for `/metrics`). Required once an API key is created. |
| `UPTIME_KUMA_POLL_INTERVAL`  | `number`  |  `60000`   | UptimeKuma polling interval in milliseconds.                      |
| `PORT`                       | `number`  |   `3000`   | Production HTTP listening port.                                   |
| `HOST`                       | `string`  | `0.0.0.0`  | Production network binding interface.                             |

---

## 📱 Display Modes

### 1. Standard Desktop Dashboard
Navigate to `http://localhost:3000/`.
- Dynamically adapts grid geometry on viewport resize via debounced `ResizeObserver`.
- Click or press `Enter`/`Space` on any cell to open the side panel inspection view (latency, 24h & 7d availability, 24-hour hourly timeline, incident history).
- Switch themes, toggle sound alerts, or configure clock and speed preferences in the settings modal.

### 2. TV & NOC Wallboard (`?tv=1`)
Append `?tv=1` to the URL: `http://localhost:3000/?tv=1`
- **Automatic Fullscreen**: Requests native fullscreen mode on initial user interaction.
- **Cursor Auto-Hide**: Mouse cursor fades out after 5 seconds of inactivity.
- **Anti Burn-In Drift**: Subtle, periodic ±3px position shifts (`animate-kato-drift`) protect OLED, AMOLED, and plasma panels.
- **Screen Wake Lock**: Prevents TVs and monitors from entering sleep or screensaver modes.
- **Continuous Marquee**: Active incident ticker loops smoothly across the footer.
- Exit anytime using `Escape`.

### 3. Mobile & Tablet
Open on mobile devices (`viewport < 768px`):
- Responsive touch-friendly layout with smooth vertical scrolling (`overflow-y-auto`).
- **44px minimum touch targets** compliant with Apple HIG and Google Material guidelines.
- Tap a probe to open a full-screen bottom sheet with detailed metrics.
- **Pull-to-Refresh**: Native touch pull-down gesture to trigger a manual refresh.

---

## 🏗️ Architecture Overview

```text
┌─────────────────────────────────────────────────────────────┐
│                    EXTERNAL PROVIDERS                       │
│   UptimeRobot API v3 / UptimeKuma /metrics / Other APIs     │
└─────────────────────────────┬───────────────────────────────┘
                              │ HTTP Polling (Node.js Server)
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    SVELTEKIT BFF SERVER                     │
│                                                             │
│   src/lib/server/adapters/                                  │
│   ├── mock.adapter.ts                                       │
│   ├── uptime-robot.adapter.ts                               │
│   └── uptime-kuma.adapter.ts                                │
│                                                             │
│   src/lib/server/poller.ts (Background polling loop)        │
│                │                                            │
│                ▼                                            │
│   src/lib/server/store.ts (In-Memory Singleton RAM)         │
│   ├── Map<string, NormalizedProbe>                          │
│   ├── Map<string, NormalizedIncident> (24h sliding window)  │
│   └── Diffing & Delta Generator (DashboardDelta)            │
│                │                                            │
│                ▼                                            │
│   src/routes/api/events/+server.ts                          │
│   └── SSE Stream: init (snapshot), update (deltas), heartbeat│
└─────────────────────────────┬───────────────────────────────┘
                              │ text/event-stream (SSE)
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      BROWSER CLIENT                         │
│                                                             │
│   src/lib/utils/sse-client.ts (EventSource + auto-reconnect)│
│   src/lib/utils/grid-calculator.ts (Zero-scroll geometry)   │
│   src/routes/+page.svelte (Svelte 5 Runes Orchestration)    │
│                                                             │
│   src/lib/components/                                       │
│   ├── Header.svelte (Score, ARIA badges, freshness, clock)  │
│   ├── ProbeGrid.svelte (Dynamic CSS Grid + FLIP animations) │
│   ├── ProbeCell.svelte / ProbeDot.svelte                    │
│   ├── IncidentBar.svelte (aria-live, TV marquee ticker)     │
│   └── DetailModal.svelte (Side-panel metrics & history)     │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔌 Adding a Custom Monitoring Adapter

Kato uses the **Adapter Pattern** to isolate external monitoring providers. To add a new provider (e.g. Pingdom, Better Uptime, Datadog, or internal Prometheus):

### Step 1: Implement `MonitoringAdapter`
Create `src/lib/server/adapters/my-service.adapter.ts`:

```typescript
import type {
    MonitoringAdapter,
    AdapterConfig,
    NormalizedProbe,
    NormalizedIncident
} from '$lib/types';

export class MyServiceAdapter implements MonitoringAdapter {
    readonly name = 'myservice';
    private apiKey = '';
    private pollIntervalMs = 30000;

    async initialize(config: AdapterConfig): Promise<void> {
        this.apiKey = (config.apiKey as string) ?? '';
        this.pollIntervalMs = (config.pollInterval as number) ?? 30000;
    }

    async fetchProbes(): Promise<NormalizedProbe[]> {
        const response = await fetch('https://api.myservice.com/v1/monitors', {
            headers: { Authorization: `Bearer ${this.apiKey}` }
        });
        const data = await response.json();

        return data.monitors.map((item: any) => ({
            id: String(item.id),
            name: item.name,
            url: item.url ?? null,
            status: item.is_up ? 'up' : 'down',
            responseTime: item.latency_ms ?? null,
            uptime24h: item.uptime_24h ?? 100,
            uptime7d: item.uptime_7d ?? 100,
            criticality: 'critical',
            lastCheck: new Date().toISOString(),
            group: item.category ?? null,
            source: this.name
        }));
    }

    async fetchIncidents(since: Date): Promise<NormalizedIncident[]> {
        return []; // Optional: return incidents if supported by provider
    }

    getPollingInterval(): number {
        return this.pollIntervalMs;
    }
}
```

### Step 2: Register the Adapter in `src/hooks.server.ts`

```typescript
if (adapterType === 'uptimerobot') {
    adapter = new UptimeRobotAdapter();
    // ...
} else if (adapterType === 'uptimekuma') {
    adapter = new UptimeKumaAdapter();
    // ...
} else if (adapterType === 'myservice') {
    adapter = new MyServiceAdapter();
    await adapter.initialize({
        apiKey: process.env.MY_SERVICE_API_KEY,
        pollInterval: 30000
    });
} else {
    adapter = new MockAdapter();
    // ...
}
```

### Step 3: Configure `.env`

```env
KATO_ADAPTER=myservice
MY_SERVICE_API_KEY=your_secret_api_key
```

---

## 🧪 Testing & Verification

```bash
# Run unit tests (Node.js test runner)
npm test

# SvelteKit type checking
npm run check

# Code linting
npm run lint

# Production build
npm run build
```

---

## 📄 License

This project is licensed under the [MIT License](LICENSE) © 2026 Jeremy.
