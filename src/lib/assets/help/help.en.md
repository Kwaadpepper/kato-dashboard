# KATO User Guide & Shortcuts

**KATO** is a high-density wallboard monitoring dashboard designed for desktop and TV screens, ensuring complete real-time visibility with zero scrolling required.

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action | Description |
| :--- | :--- | :--- |
| `↑` `↓` `←` `→` | Grid Navigation | Move cell-by-cell across monitored probes |
| `Home` / `End` | First / Last Probe | Jump immediately to the beginning or end of the grid |
| `Enter` / `Space` | Open Details | View 24h history, availability bar, and reliability KPIs |
| `Esc` | Close / Exit | Close active modal or exit TV / fullscreen mode |
| `F` | Fullscreen | Toggle immersive fullscreen display |
| `M` | Sound Alerts | Mute or unmute audio alert tones |
| `T` | Theme Cycle | Quickly cycle through Dark, Light, and AMOLED themes |
| `P` | Pause Marquee | Pause or resume the bottom incident ticker |
| `Tab` / `Shift + Tab` | Focus Navigation | Cycle focus through accessible regions and controls |
| `?` | Open Help | Display this documentation and keyboard shortcuts |

---

## 🟢 Status Indicators

- **UP** (Green): Probe is healthy and responding normally. Optimal uptime.
- **DEGRADED** (Amber): Response time is unusually high or temporary degradation detected.
- **DOWN** (Flashing Red): Probe is unreachable or experiencing a confirmed service outage.
- **PAUSED** (Gray): Monitoring is temporarily paused.
- **MAINTENANCE** (Purple): Scheduled maintenance window in progress.
- **PENDING** (Blue): Initialization or first check currently running.

---

## 📺 TV Mode & Wallboard Supervision

TV mode is tailored for unattended wallboard displays:

- **Cursor Auto-hide**: Mouse cursor hides automatically after 5 seconds of inactivity.
- **Anti Burn-in Drift**: Subtle micro-movements across long cycles to prevent OLED and LED panel burn-in.
- **Smooth Incident Marquee**: 60 fps continuous scrolling ticker for active and recent incidents.
- **Real-time Synchronization**: Persistent Server-Sent Events (SSE) connection with automatic reconnection on network drops.

---

## ⚙️ Available Settings

Access settings via the gear icon in the top header:

1. **Language**: Switch between English and French with instant UI synchronization.
2. **Fullscreen**: Activate borderless browser display mode.
3. **Visual Themes**: Dark (default), Light (bright rooms), AMOLED (pure black), or Auto (matches OS preference).
4. **Marquee Speed**: Fast, Normal, and Slow presets or precise custom duration sliders (15s to 120s).
5. **Clock & Timezone**: Toggle 24h or 12h formats, show/hide seconds, and select your preferred reference timezone.
