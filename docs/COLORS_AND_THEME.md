# Palette de Couleurs, Animations et Thèmes

Ce document constitue la référence officielle du design system pour le tableau de bord de supervision **Kato**. Il formalise la charte chromatique sémantique, le comportement des tuiles et cellules selon les thèmes visuels (Dark, Light, AMOLED), les animations CSS dynamiques d'état et d'alerte, ainsi que l'intégration Tailwind CSS et les variables personnalisées (CSS Custom Properties).

---

## 1. Palette Sémantique

La palette sémantique attribue à chaque statut de sonde un code couleur normalisé garantissant un repérage visuel immédiat en salle de contrôle (mode TV / NOC) et sur poste de travail.

| État | Tailwind Class (bg) | Tailwind Class (text) | Hex | Bordure | Icône SVG path suggestion |
|---|---|---|---|---|---|
| **UP** | `bg-emerald-500` | `text-emerald-400` | `#10B981` | `border-emerald-700/50` | `M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z` (*checkmark circle*) |
| **DOWN** | `bg-red-500` | `text-red-400` | `#EF4444` | `border-red-500/60` | `M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z` (*x-circle*) |
| **DEGRADED** | `bg-amber-500` | `text-amber-400` | `#F59E0B` | `border-amber-600/50` | `M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z` (*alert-triangle*) |
| **PAUSED** | `bg-slate-500` | `text-slate-400` | `#6B7280` | `border-slate-600/30` | `M15.75 5.25v13.5m-7.5-13.5v13.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z` (*pause-circle*) |
| **PENDING** | `bg-blue-500` | `text-blue-400` | `#3B82F6` | `border-blue-600/40` | `M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99` (*loader/circle*) |
| **MAINTENANCE** | `bg-violet-500` | `text-violet-400` | `#8B5CF6` | `border-violet-600/40` | `M21.75 6.75a4.5 4.5 0 01-4.884 4.484c-1.076-.091-2.264.398-2.95 1.085l-7.464 7.464a2.25 2.25 0 01-3.182-3.182l7.464-7.464c.687-.686 1.176-1.874 1.085-2.95A4.5 4.5 0 0117.25 2.25h1.5a.75.75 0 01.75.75v1.5a.75.75 0 00.75.75h1.5a.75.75 0 01.75.75v.75z` (*wrench*) |

### Typage TypeScript Sémantique

```typescript
export type MonitorStatus = 'UP' | 'DOWN' | 'DEGRADED' | 'PAUSED' | 'PENDING' | 'MAINTENANCE';

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
  UP: {
    label: 'Opérationnel',
    badgeBg: 'bg-emerald-500',
    badgeText: 'text-emerald-400',
    hex: '#10B981',
    borderClass: 'border-emerald-700/50',
    iconName: 'checkmark-circle',
    svgPath: 'M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  },
  DOWN: {
    label: 'En panne',
    badgeBg: 'bg-red-500',
    badgeText: 'text-red-400',
    hex: '#EF4444',
    borderClass: 'border-red-500/60',
    iconName: 'x-circle',
    svgPath: 'M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  },
  DEGRADED: {
    label: 'Dégradé',
    badgeBg: 'bg-amber-500',
    badgeText: 'text-amber-400',
    hex: '#F59E0B',
    borderClass: 'border-amber-600/50',
    iconName: 'alert-triangle',
    svgPath: 'M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z',
  },
  PAUSED: {
    label: 'En pause',
    badgeBg: 'bg-slate-500',
    badgeText: 'text-slate-400',
    hex: '#6B7280',
    borderClass: 'border-slate-600/30',
    iconName: 'pause-circle',
    svgPath: 'M15.75 5.25v13.5m-7.5-13.5v13.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  },
  PENDING: {
    label: 'En attente',
    badgeBg: 'bg-blue-500',
    badgeText: 'text-blue-400',
    hex: '#3B82F6',
    borderClass: 'border-blue-600/40',
    iconName: 'loader-circle',
    svgPath: 'M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99',
  },
  MAINTENANCE: {
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

## 2. Fonds des Cellules par Thème

L'habillage des cartes de sondes s'adapte selon trois thèmes :
- **Dark** : Teintes semi-transparentes sombres sur fond d'interface gris ardoise (`slate-900`/`slate-800`).
- **Light** : Teintes pastel très légères avec texte à fort contraste pour bureau lumineux.
- **AMOLED** : Fond noir pur (`#000000`) avec bordure colorée contrastée pour économiser l'énergie et éviter la rémanence sur écrans OLED / TV dédiés.

| État | Thème Dark | Thème Light | Thème AMOLED |
|---|---|---|---|
| **UP** | `bg-emerald-900/30 border-emerald-700/50 text-emerald-300` | `bg-emerald-50 border-emerald-200 text-emerald-800` | `bg-black border-emerald-800 text-emerald-400` |
| **DOWN** | `bg-red-900/40 border-red-500/60 text-red-300` | `bg-red-50 border-red-200 text-red-800` | `bg-black border-red-800 text-red-400` |
| **DEGRADED** | `bg-amber-900/30 border-amber-600/50 text-amber-300` | `bg-amber-50 border-amber-200 text-amber-800` | `bg-black border-amber-800 text-amber-400` |
| **PAUSED** | `bg-slate-800/40 border-slate-600/30 text-slate-400` | `bg-slate-100 border-slate-300 text-slate-700` | `bg-black border-zinc-800 text-zinc-500` |
| **PENDING** | `bg-blue-900/30 border-blue-600/40 text-blue-300` | `bg-blue-50 border-blue-200 text-blue-800` | `bg-black border-blue-800 text-blue-400` |
| **MAINTENANCE** | `bg-violet-900/30 border-violet-600/40 text-violet-300` | `bg-violet-50 border-violet-200 text-violet-800` | `bg-black border-violet-800 text-violet-400` |

### Implémentation Helper TypeScript

```typescript
export type ThemeMode = 'dark' | 'light' | 'amoled';

export function getCardThemeClasses(status: MonitorStatus, theme: ThemeMode): string {
  const themeMatrix: Record<ThemeMode, Record<MonitorStatus, string>> = {
    dark: {
      UP: 'bg-emerald-900/30 border-emerald-700/50 text-emerald-300',
      DOWN: 'bg-red-900/40 border-red-500/60 text-red-300',
      DEGRADED: 'bg-amber-900/30 border-amber-600/50 text-amber-300',
      PAUSED: 'bg-slate-800/40 border-slate-600/30 text-slate-400',
      PENDING: 'bg-blue-900/30 border-blue-600/40 text-blue-300',
      MAINTENANCE: 'bg-violet-900/30 border-violet-600/40 text-violet-300',
    },
    light: {
      UP: 'bg-emerald-50 border-emerald-200 text-emerald-800',
      DOWN: 'bg-red-50 border-red-200 text-red-800',
      DEGRADED: 'bg-amber-50 border-amber-200 text-amber-800',
      PAUSED: 'bg-slate-100 border-slate-300 text-slate-700',
      PENDING: 'bg-blue-50 border-blue-200 text-blue-800',
      MAINTENANCE: 'bg-violet-50 border-violet-200 text-violet-800',
    },
    amoled: {
      UP: 'bg-black border-emerald-800 text-emerald-400',
      DOWN: 'bg-black border-red-800 text-red-400',
      DEGRADED: 'bg-black border-amber-800 text-amber-400',
      PAUSED: 'bg-black border-zinc-800 text-zinc-500',
      PENDING: 'bg-black border-blue-800 text-blue-400',
      MAINTENANCE: 'bg-black border-violet-800 text-violet-400',
    },
  };

  return themeMatrix[theme][status];
}
```

---

## 3. Animations CSS

Les animations alertent les opérateurs sur les incidents critiques et assurent la protection des écrans d'affichage continu.

### Pulse Alert (sondes DOWN)
Déclenchée immédiatement lorsqu'une sonde bascule en panne (`DOWN`) pour attirer l'attention.

```css
@keyframes kato-pulse {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.04); opacity: 0.8; }
}
.animate-kato-pulse {
  animation: kato-pulse 2s ease-in-out infinite;
}
```

### Glow (sondes DOWN > 1min)
Appliqué aux sondes toujours hors service après 60 secondes pour matérialiser la persistance critique d'un incident majeur.

```css
.kato-glow-red {
  box-shadow: 0 0 15px 2px rgba(239, 68, 68, 0.3),
              0 0 30px 4px rgba(239, 68, 68, 0.1);
}
```

### Border Flash (transition UP → DOWN)
Flash visuel déclenché 3 fois lors de la transition d'état `UP → DOWN`.

```css
@keyframes kato-border-flash {
  0%, 100% { box-shadow: inset 0 0 0 2px transparent; }
  25%, 75% { box-shadow: inset 0 0 0 2px rgba(239, 68, 68, 0.6); }
}
.animate-kato-border-flash {
  animation: kato-border-flash 0.5s ease-in-out 3;
}
```

### Incident Marquee (mode TV)
Bandeau d'actualités/incidents défilant en continu en bas d'écran en affichage mural (Mode TV / NOC).

```css
@keyframes kato-marquee {
  0% { transform: translateX(100%); }
  100% { transform: translateX(-100%); }
}
.animate-kato-marquee {
  animation: kato-marquee 30s linear infinite;
}
```

### Anti Burn-in drift
Dérive microscopique périodique imperceptible à l'œil nu (translation de quelques pixels sur 10 minutes) protégeant les dalles OLED / AMOLED du marquage d'écran (*burn-in*).

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

## 4. Reduced Motion

Pour respecter l'accessibilité système (`prefers-reduced-motion: reduce`) et éviter les gênes vestibulaires, toutes les animations répétitives ou de translation doivent être neutralisées :

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

## 5. Tailwind Config Extensions

Fichier de configuration TypeScript [`tailwind.config.ts`](file:///var/www-jeremy/projets/kato-dashboard/tailwind.config.ts) intégrant les animations, keyframes, ombrages et variables thématiques de Kato :

```typescript
// tailwind.config.ts
import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      animation: {
        'kato-pulse': 'kato-pulse 2s ease-in-out infinite',
        'kato-border-flash': 'kato-border-flash 0.5s ease-in-out 3',
        'kato-marquee': 'kato-marquee 30s linear infinite',
        'kato-drift': 'kato-drift 600s ease-in-out infinite',
      },
      keyframes: {
        'kato-pulse': {
          '0%, 100%': { transform: 'scale(1)', opacity: '1' },
          '50%': { transform: 'scale(1.04)', opacity: '0.8' },
        },
        'kato-border-flash': {
          '0%, 100%': { boxShadow: 'inset 0 0 0 2px transparent' },
          '25%, 75%': { boxShadow: 'inset 0 0 0 2px rgba(239, 68, 68, 0.6)' },
        },
        'kato-marquee': {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(-100%)' },
        },
        'kato-drift': {
          '0%, 100%': { transform: 'translate(0, 0)' },
          '25%': { transform: 'translate(3px, 1px)' },
          '50%': { transform: 'translate(-2px, 3px)' },
          '75%': { transform: 'translate(1px, -2px)' },
        },
      },
      boxShadow: {
        'kato-glow-red': '0 0 15px 2px rgba(239, 68, 68, 0.3), 0 0 30px 4px rgba(239, 68, 68, 0.1)',
      },
      colors: {
        kato: {
          bg: {
            primary: 'var(--kato-bg-primary)',
            secondary: 'var(--kato-bg-secondary)',
          },
          text: {
            primary: 'var(--kato-text-primary)',
            secondary: 'var(--kato-text-secondary)',
          },
          border: 'var(--kato-border)',
        },
      },
    },
  },
  plugins: [],
};

export default config;
```

---

## 6. CSS Custom Properties for Themes

Feuille de style globale (`src/index.css` ou `src/styles/theme.css`) gérant l'héritage dynamique des variables CSS selon l'attribut `data-theme` sur l'élément racine (`<html>` ou `<body>`).

```css
:root, [data-theme='dark'] {
  --kato-bg-primary: #0F172A;
  --kato-bg-secondary: #1E293B;
  --kato-text-primary: #F8FAFC;
  --kato-text-secondary: #94A3B8;
  --kato-border: #334155;
}

[data-theme='light'] {
  --kato-bg-primary: #F8FAFC;
  --kato-bg-secondary: #FFFFFF;
  --kato-text-primary: #0F172A;
  --kato-text-secondary: #64748B;
  --kato-border: #E2E8F0;
}

[data-theme='amoled'] {
  --kato-bg-primary: #000000;
  --kato-bg-secondary: #0A0A0A;
  --kato-text-primary: #F8FAFC;
  --kato-text-secondary: #71717A;
  --kato-border: #27272A;
}

/* Application des variables de base au conteneur principal */
body {
  background-color: var(--kato-bg-primary);
  color: var(--kato-text-primary);
  border-color: var(--kato-border);
}

/* Gestion du respect de reduced motion */
@media (prefers-reduced-motion: reduce) {
  .animate-kato-pulse,
  .animate-kato-border-flash,
  .animate-kato-marquee,
  .animate-kato-drift {
    animation: none !important;
  }
}
```
