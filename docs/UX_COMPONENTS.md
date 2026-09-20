# UX Components Specification — Kato

This document provides the visual and technical specifications for all user interface components in the Kato monitoring dashboard. It specifies each Svelte component's structural layout, reactive behaviors, accessibility semantics, and complete Tailwind CSS classes.

---

## 1. Header (`Header.svelte`)

The Header is a fixed navigation bar at the top of the viewport providing a macroscopic summary of monitored infrastructure health.

### 1.1 Geometry & General Styles
- **Positioning**: Fixed at top (`fixed top-0 left-0 right-0 z-50 w-full`).
- **Standard Height**: ~48px (`h-12`).
- **Background & Glassmorphism**: `bg-slate-900/80 backdrop-blur-sm border-b border-slate-800/60`.
- **High-Density Mode (> 100 probes)**: Reduces to ~32px (`h-8`) with condensed padding and compact fonts.
- **Mobile Responsive (`< 768px`)**: Displays operational score (`197/200 UP`), status count badges, and current time. Secondary elements are hidden to prevent text overflow.

### 1.2 Elements Layout (Left to Right)

1. **KATO Brand**:
   - Classes: `text-lg font-bold text-white tracking-wider select-none shrink-0`.
2. **Global Availability Score**:
   - Format: `197/200 UP`.
   - Typography: Bold monospace numerals (`font-mono font-bold text-sm sm:text-base`).
   - Dynamic threshold coloring:
     - **> 95%**: `text-emerald-400`
     - **80%–95%**: `text-amber-400`
     - **< 80%**: `text-red-400 animate-pulse`
3. **Status Count Badges**:
   - Pill badges reporting monitor counts by status: `🟢 197`, `🟡 1`, `🔴 2`, `⏸ 0`.
   - Base structure: `flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium font-mono shrink-0`.
   - Color mapping:
     - **UP (🟢)**: `bg-emerald-950/60 text-emerald-300 border border-emerald-800/50`
     - **DEGRADED (🟡)**: `bg-amber-950/60 text-amber-300 border border-amber-800/50`
     - **DOWN (🔴)**: `bg-red-950/60 text-red-300 border border-red-800/60 animate-pulse` (when count > 0)
     - **PAUSED (⏸)**: `bg-slate-800/50 text-slate-300 border border-slate-700/50`
     - **PENDING / MAINTENANCE**: `bg-violet-950/60 text-violet-300 border border-violet-800/50`
4. **Spacer**: Flexible expanding divider (`flex-1`).
5. **Real-Time Clock**:
   - Monospace digital clock: `text-slate-400 font-mono text-sm tracking-tight shrink-0`.
   - Format: `HH:MM:SS` (or `HH:MM` without seconds when toggled).
6. **Data Freshness Indicator**:
   - Display: `"↻ 12s"` (seconds elapsed since last payload).
   - Base classes: `font-mono text-xs px-2 py-0.5 rounded-md border flex items-center gap-1 shrink-0`.
   - Threshold color coding:
     - **< 30s (Green)**: `text-emerald-400 border-emerald-900/40 bg-emerald-950/20`
     - **30s–60s (Amber)**: `text-amber-400 border-amber-900/40 bg-amber-950/20`
     - **> 60s (Red)**: `text-red-400 border-red-900/50 bg-red-950/30 font-bold animate-pulse`

---

## 2. ProbeGrid (`ProbeGrid.svelte`)

The grid container orchestrates the presentation of all monitored probes, maximizing screen surface area to eliminate vertical scrolling.

### 2.1 Geometry & Constraints
- **Container Area**: `w-full h-[calc(100vh-48px-40px)]` (Viewport height minus Header and IncidentBar).
- **Zero-Scroll Policy**: Strictly `overflow-hidden` on desktop and TV wallboard displays. Vertical scrolling (`overflow-y-auto`) is enabled exclusively on mobile resolutions (`< 768px`).

### 2.2 CSS Grid Architecture
- Responsive CSS Grid:
  ```css
  display: grid;
  grid-template-columns: repeat(var(--grid-columns), minmax(0, var(--cell-size)));
  gap: var(--grid-gap);
  ```
- Dynamic gaps:
  - **Pixel mode (> 300 probes)**: gap `4px`
  - **Micro mode (121–300 probes)**: gap `6px`
  - **Compact mode (49–120 probes)**: gap `8px`
  - **Medium / Large mode (1–48 probes)**: gap `12px`

### 2.3 Outage Spatial Promotion & Reordering
- **Priority Sorting**: Probes in `down` status are sorted first (top-left position in the grid), followed by `degraded`, `maintenance`, `pending`, `paused`, and `up`.
- **Smooth FLIP Animations**: Cells transition smoothly during re-ordering without disruptive layout jumps.

---

## 3. ProbeCell (`ProbeCell.svelte`) — Large Mode (1–12 Probes)

Large mode is active when monitoring between 1 and 12 probes. It delivers maximum detail in a balanced 3-zone structure.

### 3.1 Card Structure
- **Container**: `rounded-xl p-3.5 sm:p-4 shadow-lg flex flex-col justify-between h-full relative overflow-hidden select-none transition-colors duration-150`.
- **Hover**: Subtle border highlighting (`hover:border-slate-500`) without scaling or shifting.
- **Theme Backgrounds by Status**:
  - **`up`**: `bg-emerald-900/30 border border-emerald-700/50`
  - **`down`**: `bg-red-900/40 border border-red-500/60`
  - **`degraded`**: `bg-amber-900/30 border border-amber-600/50`
  - **`paused`**: `bg-slate-800/50 border border-slate-600/30`
  - **`pending`**: `bg-blue-900/30 border border-blue-600/40`
  - **`maintenance`**: `bg-violet-900/30 border border-violet-600/40`

### 3.2 Three-Zone Layout
1. **Header Zone**:
   - Cleaned target URL (protocol stripped): `text-[11px] font-mono text-slate-400 truncate`.
   - Distinctive status icon (Lucide SVG: `CircleCheck`, `CircleX`, `AlertTriangle`, etc.).
2. **Body Zone**:
   - Full probe name (`line-clamp-3 break-words text-white font-semibold text-sm sm:text-base`).
3. **Footer Zone**:
   - Mini metric pills (`.kato-pill`) for 24h Uptime and Response Latency:
     - Semi-transparent background with subtle borders.
     - Monospace numeric readout.

---

## 4. ProbeCell — Medium Mode (13–48 Probes)

Medium mode balances surface area for intermediate clusters (13 to 48 probes) while retaining core metrics.

### 4.1 Specifications
- **Card**: `rounded-lg p-2.5 sm:p-3 flex flex-col justify-between border shadow-md relative overflow-hidden`.
- **Status Indicator**: Compact colored dot (`w-2.5 h-2.5 rounded-full`) aligned to top-right.
- **Probe Title**: 2 lines maximum (`line-clamp-2 break-words font-medium text-white text-xs sm:text-sm`).
- **Footer**: Side-by-side 24h uptime and latency pills.

---

## 5. ProbeCell — Compact Mode (49–120 Probes)

Compact mode maximizes visibility for dense environments (49 to 120 probes) using a vertically stacked hierarchy to prevent text overlap.

### 5.1 Specifications
- **Card**: `rounded-md p-2 relative flex flex-col justify-between h-full overflow-hidden border shadow-xs`.
- **Top**: Mini status dot (`w-2 h-2 rounded-full`).
- **Center**: Centered probe name (`line-clamp-2 break-words text-center text-xs font-medium text-white`).
- **Bottom**: Monospace latency label (`text-[10px] sm:text-[11px] font-mono text-slate-400 text-center`).

---

## 6. ProbeDot (`ProbeDot.svelte`) — Micro Mode (121–300 Probes)

For high-density collections between 121 and 300 probes, textual cards transition to compact circular dots.

### 6.1 Specifications
- **Dimensions**: Scaled circular dot (`rounded-full`) sized automatically by container geometry.
- **Background**: Solid semantic status color (`bg-emerald-500`, `bg-red-500 animate-pulse`, etc.).
- **Interactive Tooltip**: Floating contextual card on hover and keyboard focus:
  - Full probe title.
  - Uppercase status label with response latency.
  - 24h availability percentage.

---

## 7. ProbeDot — Pixel Mode (> 300 Probes)

Above 300 monitors, the dashboard transitions into a dense status matrix resembling a heatmap.

### 7.1 Specifications
- **Dimensions**: Miniature square pixel (`rounded-none sm:rounded-[0.5px]`).
- **Visuals**: Full status color fill with hover enlargement (`hover:scale-110 hover:ring-1 hover:ring-white/60`).
- **Interaction**: Contextual hover tooltip reporting title, latency, and status.

---

## 8. IncidentBar (`IncidentBar.svelte`)

Fixed footer bar displaying active alerts and ongoing incident tickers.

### 8.1 Geometry & Visual Styles
- **Position & Dimensions**: Fixed at bottom (`fixed bottom-0 left-0 right-0 z-40 w-full h-10`).
- **Nominal State (No Incidents)**:
  - Background: `bg-slate-900/90 border-t border-slate-700/50`.
  - Content: `text-slate-500 text-sm font-medium flex items-center justify-center gap-2 select-none` → `"✓ Operational"`.
- **Active Incident State**:
  - Background: `bg-red-950/80 border-t border-red-800/60 backdrop-blur-sm text-red-200`.

### 8.2 TV Mode: Continuous Horizontal Marquee
When TV mode is active and incidents exist, the footer transforms into a continuous scrolling ticker:

```css
@keyframes marquee-scroll {
  0% { transform: translateX(0%); }
  100% { transform: translateX(-50%); }
}

.animate-marquee {
  display: flex;
  width: max-content;
  animation: marquee-scroll 30s linear infinite;
}

.animate-marquee:hover {
  animation-play-state: paused;
}
```

---

## 9. DetailModal (`DetailModal.svelte`)

Side inspection panel opened upon selecting any probe.

### 9.1 Features & Layout
- **Drawer Geometry**: Full-screen bottom sheet on mobile (`< 640px`), slide-in side panel on desktop (`sm:max-w-md sm:h-full`).
- **Metrics**: 24h & 7d availability, latest latency, criticality level, provider source, and timestamp.
- **24-Hour Timeline Bar**: 24 discrete 1-hour slots color-coded by dominant hourly status (Operational, Degraded, Down).
- **Incident History**: Chronological log of past and ongoing outages with started/resolved times, durations, and root causes.
- **Accessibility**: Full focus trap with `Escape` key close and focus restoration.

---

## 10. LoginForm (`LoginForm.svelte`)

Centered standalone authentication component for password-protected installations.

### 10.1 Elements
- **Logo**: Distinctive bold header branding.
- **Password Input**: Accessible input linked to error alerts (`aria-invalid`, `aria-describedby`).
- **Error Banner**: High-contrast error message for invalid credentials.
- **Submit Action**: Primary action button with loading states.

---

## 11. TV & Wallboard Mode (`?tv=1`)

Designed for unattended 24/7 continuous operation on wallboards, control rooms, and displays:

1. **Automatic Fullscreen**: Requests native fullscreen on initial user gesture.
2. **Cursor Auto-Hide**: Mouse cursor hides after 5 seconds of inactivity.
3. **Anti Burn-In Drift**: Microscopic ±3px position shifts every 10 minutes prevent panel image retention.
4. **Screen Wake Lock**: Prevents displays from dimming or sleeping.
5. **Marquee Incident Ticker**: Loops active incidents smoothly across the footer.
