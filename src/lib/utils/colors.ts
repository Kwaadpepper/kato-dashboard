import type { ProbeStatus, SupportedLocale } from '$lib/types';
import { t } from '../i18n/index.ts';

/**
 * Visual styling and Tailwind class configuration for a given probe status.
 */
export interface StatusColorConfig {
	/** Solid Tailwind background class (e.g. 'bg-emerald-500') */
	bgClass: string;
	/** Tailwind text class (e.g. 'text-emerald-400') */
	textClass: string;
	/** Dark theme card background class (e.g. 'bg-emerald-900/30') */
	cardBgClass: string;
	/** Tailwind border class (e.g. 'border-emerald-700/50') */
	borderClass: string;
	/** Condensed badge background class */
	badgeBgClass: string;
	/** Condensed badge text class */
	badgeTextClass: string;
	/** Canonical hexadecimal color */
	hex: string;
	/** Default English label */
	label: string;
}

/**
 * Official status-to-color mapping for Kato Dashboard.
 * Complies with docs/COLORS_AND_THEME.md and docs/UX_COMPONENTS.md.
 */
export const STATUS_COLORS: Record<ProbeStatus, StatusColorConfig> = {
	up: {
		bgClass: 'bg-emerald-500',
		textClass: 'text-emerald-400',
		cardBgClass: 'bg-emerald-900/30',
		borderClass: 'border-emerald-700/50',
		badgeBgClass: 'bg-emerald-950/60',
		badgeTextClass: 'text-emerald-300',
		hex: '#10B981',
		label: 'Operational'
	},
	down: {
		bgClass: 'bg-red-500',
		textClass: 'text-red-400',
		cardBgClass: 'bg-red-900/40',
		borderClass: 'border-red-500/60',
		badgeBgClass: 'bg-red-950/60',
		badgeTextClass: 'text-red-300',
		hex: '#EF4444',
		label: 'Down'
	},
	degraded: {
		bgClass: 'bg-amber-500',
		textClass: 'text-amber-400',
		cardBgClass: 'bg-amber-900/30',
		borderClass: 'border-amber-600/50',
		badgeBgClass: 'bg-amber-950/60',
		badgeTextClass: 'text-amber-300',
		hex: '#F59E0B',
		label: 'Degraded'
	},
	paused: {
		bgClass: 'bg-slate-500',
		textClass: 'text-slate-400',
		cardBgClass: 'bg-slate-800/50',
		borderClass: 'border-slate-600/30',
		badgeBgClass: 'bg-slate-800/50',
		badgeTextClass: 'text-slate-300',
		hex: '#6B7280',
		label: 'Paused'
	},
	pending: {
		bgClass: 'bg-blue-500',
		textClass: 'text-blue-400',
		cardBgClass: 'bg-blue-900/30',
		borderClass: 'border-blue-600/40',
		badgeBgClass: 'bg-blue-950/60',
		badgeTextClass: 'text-blue-300',
		hex: '#3B82F6',
		label: 'Pending'
	},
	maintenance: {
		bgClass: 'bg-violet-500',
		textClass: 'text-violet-400',
		cardBgClass: 'bg-violet-900/30',
		borderClass: 'border-violet-600/40',
		badgeBgClass: 'bg-violet-950/60',
		badgeTextClass: 'text-violet-300',
		hex: '#8B5CF6',
		label: 'Maintenance'
	}
};

/**
 * Returns the Lucide icon component name corresponding to a status.
 *
 * @param status Operational status of the probe
 * @returns Lucide icon component name ('CircleCheck', 'CircleX', 'TriangleAlert', etc.)
 */
export function getStatusIcon(status: ProbeStatus): string {
	switch (status) {
		case 'up':
			return 'CircleCheck';
		case 'down':
			return 'CircleX';
		case 'degraded':
			return 'TriangleAlert';
		case 'paused':
			return 'CirclePause';
		case 'pending':
			return 'LoaderCircle';
		case 'maintenance':
			return 'Wrench';
	}
}

/**
 * Returns the translated status label based on current active locale or an explicit locale.
 */
export function getStatusLabel(status: ProbeStatus, locale?: SupportedLocale): string {
	return t(`status.${status}`, undefined, locale);
}
