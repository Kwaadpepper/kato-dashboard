import type { ProbeStatus, SupportedLocale } from '$lib/types';
import { t } from '../i18n/index.ts';

/**
 * Configuration chromatique et utilitaires Tailwind pour un statut de sonde donné.
 */
export interface StatusColorConfig {
	/** Classe d'arrière-plan Tailwind plein (ex: 'bg-emerald-500') */
	bgClass: string;
	/** Classe de texte Tailwind (ex: 'text-emerald-400') */
	textClass: string;
	/** Classe d'arrière-plan pour carte thème sombre (ex: 'bg-emerald-900/30') */
	cardBgClass: string;
	/** Classe de bordure Tailwind (ex: 'border-emerald-700/50') */
	borderClass: string;
	/** Classe de fond pour badge/pastille condensé */
	badgeBgClass: string;
	/** Classe de texte pour badge/pastille condensé */
	badgeTextClass: string;
	/** Code hexadécimal canonique */
	hex: string;
	/** Libellé en français */
	label: string;
}

/**
 * Mapping officiel des couleurs par statut de sonde pour le dashboard Kato.
 * Conforme à docs/COLORS_AND_THEME.md et docs/UX_COMPONENTS.md.
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
		label: 'Opérationnel'
	},
	down: {
		bgClass: 'bg-red-500',
		textClass: 'text-red-400',
		cardBgClass: 'bg-red-900/40',
		borderClass: 'border-red-500/60',
		badgeBgClass: 'bg-red-950/60',
		badgeTextClass: 'text-red-300',
		hex: '#EF4444',
		label: 'En panne'
	},
	degraded: {
		bgClass: 'bg-amber-500',
		textClass: 'text-amber-400',
		cardBgClass: 'bg-amber-900/30',
		borderClass: 'border-amber-600/50',
		badgeBgClass: 'bg-amber-950/60',
		badgeTextClass: 'text-amber-300',
		hex: '#F59E0B',
		label: 'Dégradé'
	},
	paused: {
		bgClass: 'bg-slate-500',
		textClass: 'text-slate-400',
		cardBgClass: 'bg-slate-800/50',
		borderClass: 'border-slate-600/30',
		badgeBgClass: 'bg-slate-800/50',
		badgeTextClass: 'text-slate-300',
		hex: '#6B7280',
		label: 'En pause'
	},
	pending: {
		bgClass: 'bg-blue-500',
		textClass: 'text-blue-400',
		cardBgClass: 'bg-blue-900/30',
		borderClass: 'border-blue-600/40',
		badgeBgClass: 'bg-blue-950/60',
		badgeTextClass: 'text-blue-300',
		hex: '#3B82F6',
		label: 'En attente'
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
 * Retourne le nom du composant d'icône Lucide correspondant au statut.
 *
 * @param status Le statut opérationnel de la sonde
 * @returns Le nom du composant Lucide ('CircleCheck', 'CircleX', 'TriangleAlert', etc.)
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
 * Retourne le libellé traduit du statut selon la langue active ou la locale passée.
 */
export function getStatusLabel(status: ProbeStatus, locale?: SupportedLocale): string {
	return t(`status.${status}`, undefined, locale);
}

