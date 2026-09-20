# Color Palette, Animations, and Themes

This document is the official design system reference for the **Kato** monitoring dashboard. It formalizes the semantic color system, card and tile behaviors across themes (Dark, Light, AMOLED), dynamic CSS state and alert animations, Tailwind CSS v4 integration, and CSS Custom Properties.

---

## 1. Semantic Color Palette

The semantic palette maps each monitoring status to a standardized color token, ensuring immediate situational awareness in control rooms (TV / NOC mode) and on desktop workstations.

| Status | Tailwind Class (bg) | Tailwind Class (text) | Hex | Border | SVG Icon Description |
|---|---|---|---|---|---|
| **UP** | `bg-emerald-500` | `text-emerald-400` | `#10B981` | `border-emerald-700/50` | `M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z` (*checkmark circle*) |
| **DOWN** | `bg-red-500` | `text-red-400` | `#EF4444` | `border-red-500/60` | `M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z` (*x-circle*) |
| **DEGRADED** | `bg-amber-500` | `text-amber-400` | `#F59E0B` | `border-amber-600/50` | `M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z` (*alert-triangle*) |
| **PAUSED** | `bg-slate-500` | `text-slate-400` | `#6B7280` | `border-slate-600/30` | `M15.75 5.25v13.5m-7.5-13.5v13.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z` (*pause-circle*) |
| **PENDING** | `bg-blue-500` | `text-blue-400` | `#3B82F6` | `border-blue-600/40` | `M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99` (*loader-circle*) |
| **MAINTENANCE** | `bg-violet-500` | `text-violet-400` | `#8B5CF6` | `border-violet-600/40` | `M21.75 6.75a4.5 4.5 0 01-4.884 4.484c-1.076-.091-2.264.398-2.95 1.085l-7.464 7.464a2.25 2.25 0 01-3.182-3.182l7.464-7.464c.687-.686 1.176-1.874 1.085-2.95A4.5 4.5 0 0117.25 2.25h1.5a.75.75 0 01.75.75v1.5a.75.75 0 00.75.75h1.5a.75.75 0 01.75.75v.75z` (*wrench*) |

### Semantic TypeScript Typing

```typescript
export type MonitorStatus = 'up' | 'down' | 'degraded' | 'paused' | 'pending' | 'maintenance';

export interface StatusVisualConfig {
  label: string;
  badgeBg: string;
  badgeText: string;
  hex: string;
  borderClass: string;
  iconName: 'checkmark-circle' | 'x-circle' | 'alert-triangle' | 'pause-circle' | 'loader-circle' | 'wrench';
  svgPath: string;
}

export const STATUS_PALETTE: Record<MonitorStatus, StatusVisualConfig> = {
  up: {
    label: 'Operational',
    badgeBg: 'bg-emerald-500',
    badgeText: 'text-emerald-400',
    hex: '#10B981',
    borderClass: 'border-emerald-700/50',
    iconName: 'checkmark-circle',
    svgPath: 'M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  },
  down: {
    label: 'Down',
    badgeBg: 'bg-red-500',
    badgeText: 'text-red-400',
    hex: '#EF4444',
    borderClass: 'border-red-500/60',
    iconName: 'x-circle',
    svgPath: 'M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  },
  degraded: {
    label: 'Degraded',
    badgeBg: 'bg-amber-500',
    badgeText: 'text-amber-400',
    hex: '#F59E0B',
    borderClass: 'border-amber-600/50',
    iconName: 'alert-triangle',
    svgPath: 'M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z',
  },
  paused: {
    label: 'Paused',
    badgeBg: 'bg-slate-500',
    badgeText: 'text-slate-400',
    hex: '#6B7280',
    borderClass: 'border-slate-600/30',
    iconName: 'pause-circle',
    svgPath: 'M15.75 5.25v13.5m-7.5-13.5v13.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  },
  pending: {
    label: 'Pending',
    badgeBg: 'bg-blue-500',
    badgeText: 'text-blue-400',
    hex: '#3B82F6',
    borderClass: 'border-blue-600/40',
    iconName: 'loader-circle',
    svgPath: 'M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99',
  },
  maintenance: {
    label: 'Maintenance',
    badgeBg: 'bg-violet-500',
    badgeText: 'text-violet-400',
    hex: '#8B5CF6',
    borderClass: 'border-violet-600/40',
    iconName: 'wrench',
    svgPath: 'M21.75 6.75a4.5 4.5 0 01-4.884 4.484c-1.076-.091-2.264.398-2.95 1.085l-7.464 7.464a2.25 2.25 0 01-3.182-3.182l7.464-7.464c.687-.686 1.176-1.874 1.085-2.95A4.5 4.5 0 0117.25 2.25h1.5a.75.75 0 01.75.75v1.5a.75.75 0 00.75.75h1.5a.75.75 0 01.75.75v.75z',
  },
};
```

---

## 2. Cell Backgrounds by Theme

Probe card styling adapts across three supported themes:
- **Dark**: Semi-transparent dark hues over slate backgrounds (`slate-900` / `slate-800`).
- **Light**: Light pastel accents with high-contrast foreground text for well-lit office environments.
- **AMOLED**: Pure black background (`#000000`) with contrasted borders to save power and prevent image retention on OLED / TV displays.

| Status | Dark Theme | Light Theme | AMOLED Theme |
|---|---|---|---|
| **UP** | `bg-emerald-900/30 border-emerald-700/50 text-emerald-300` | `bg-emerald-50 border-emerald-200 text-emerald-800` | `bg-black border-emerald-800 text-emerald-400` |
| **DOWN** | `bg-red-900/40 border-red-500/60 text-red-300` | `bg-red-50 border-red-200 text-red-800` | `bg-black border-red-800 text-red-400` |
| **DEGRADED** | `bg-amber-900/30 border-amber-600/50 text-amber-300` | `bg-amber-50 border-amber-200 text-amber-800` | `bg-black border-amber-800 text-amber-400` |
| **PAUSED** | `bg-slate-800/40 border-slate-600/30 text-slate-400` | `bg-slate-100 border-slate-300 text-slate-700` | `bg-black border-zinc-800 text-zinc-500` |
| **PENDING** | `bg-blue-900/30 border-blue-600/40 text-blue-300` | `bg-blue-50 border-blue-200 text-blue-800` | `bg-black border-blue-800 text-blue-400` |
| **MAINTENANCE** | `bg-violet-900/30 border-violet-600/40 text-violet-300` | `bg-violet-50 border-violet-200 text-violet-800` | `bg-black border-violet-800 text-violet-400` |

---

## 3. CSS Animations

Animations alert operators to critical incidents and protect continuous display panels.

### Pulse Alert (DOWN Probes)
Triggered immediately when a probe enters `DOWN` state:

```css
@keyframes kato-pulse {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.04); opacity: 0.8; }
}
.animate-kato-pulse {
  animation: kato-pulse 2s ease-in-out infinite;
}
```

### Glow (DOWN Probes > 1 min)
Applied to probes down longer than 60 seconds to visualize persistent critical outages:

```css
.kato-glow-red {
  box-shadow: 0 0 15px 2px rgba(239, 68, 68, 0.3),
              0 0 30px 4px rgba(239, 68, 68, 0.1);
}
```

### Border Flash (UP → DOWN Transition)
Brief visual flash repeated 3 times upon state transition from `UP` to `DOWN`:

```css
@keyframes kato-border-flash {
  0%, 100% { box-shadow: inset 0 0 0 2px transparent; }
  25%, 75% { box-shadow: inset 0 0 0 2px rgba(239, 68, 68, 0.6); }
}
.animate-kato-border-flash {
  animation: kato-border-flash 0.5s ease-in-out 3;
}
```

### Incident Marquee (TV Mode)
Continuous horizontal ticker streaming active incidents along the bottom bar:

```css
@keyframes kato-marquee {
  0% { transform: translateX(0); }
  100% { transform: translateX(-50%); }
}
.animate-kato-marquee {
  animation: kato-marquee 60s linear infinite;
}
```

### Anti Burn-In Drift
Imperceptible microscopic drift (a few pixels translation over 10 minutes) protecting OLED, AMOLED, and plasma panels against image retention:

```css
@keyframes kato-drift {
  0%, 100% { transform: translate(0, 0); }
  25% { transform: translate(3px, 1px); }
  50% { transform: translate(-2px, 3px); }
  75% { transform: translate(1px, -2px); }
}
.animate-kato-drift {
  animation: kato-drift 600s ease-in-out infinite;
}
```

---

## 4. Accessibility & Reduced Motion

To comply with WCAG AA guidelines and prevent vestibular motion discomfort, all continuous or translational animations are neutralized when `prefers-reduced-motion: reduce` is detected:

```css
@media (prefers-reduced-motion: reduce) {
  .animate-kato-pulse,
  .animate-kato-border-flash,
  .animate-kato-marquee,
  .animate-kato-drift {
    animation: none !important;
  }
}
```

---

## 5. CSS Custom Properties for Themes

Global design tokens managed through the `data-theme` attribute on the root HTML element:

```css
:root, [data-theme='dark'] {
  --kato-bg-primary: #0F172A;
  --kato-bg-secondary: #1E293B;
  --kato-text-primary: #F8FAFC;
  --kato-text-secondary: #94A3B8;
  --kato-border: #334155;
  --kato-focus-ring: #38BDF8;
}

[data-theme='light'] {
  --kato-bg-primary: #F8FAFC;
  --kato-bg-secondary: #FFFFFF;
  --kato-text-primary: #0F172A;
  --kato-text-secondary: #64748B;
  --kato-border: #E2E8F0;
  --kato-focus-ring: #0284C7;
}

[data-theme='amoled'] {
  --kato-bg-primary: #000000;
  --kato-bg-secondary: #0A0A0A;
  --kato-text-primary: #F8FAFC;
  --kato-text-secondary: #71717A;
  --kato-border: #27272A;
  --kato-focus-ring: #38BDF8;
}
```
