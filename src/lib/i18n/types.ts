import type { SupportedLocale } from '$lib/types';

export type { SupportedLocale };

/**
 * Canonical translation schema for the Kato Dashboard application.
 * All locales (en, fr, etc.) must implement 100% of this structure.
 */
export interface TranslationSchema {
	common: {
		appName: string;
		loading: string;
		connectionLost: string;
		reconnecting: string;
		operational: string;
		close: string;
		recent: string;
		pageTitle: string;
		probeGridAria: string;
		opensInNewTab: string;
	};
	status: {
		up: string;
		down: string;
		degraded: string;
		paused: string;
		pending: string;
		maintenance: string;
	};
	criticality: {
		critical: string;
		high: string;
		medium: string;
		low: string;
	};
	header: {
		scoreAria: string;
		statusCountsGroup: string;
		badgeUpTitle: string;
		badgeUpAria: string;
		badgeDegradedTitle: string;
		badgeDegradedAria: string;
		badgeDownTitle: string;
		badgeDownAria: string;
		badgePausedTitle: string;
		badgePausedAria: string;
		badgePendingTitle: string;
		badgePendingAria: string;
		badgeMaintenanceTitle: string;
		badgeMaintenanceAria: string;
		clockAria: string;
		freshnessLostTitle: string;
		freshnessDelayTitle: string;
		freshnessLostAria: string;
		freshnessDelayAria: string;
		zeroScrollActiveTitle: string;
		touchActiveTitle: string;
		zeroScrollActiveAria: string;
		touchActiveAria: string;
		soundDisableTitle: string;
		soundEnableTitle: string;
		soundDisableAria: string;
		soundEnableAria: string;
		fullscreenExitTitle: string;
		fullscreenEnterTitle: string;
		fullscreenExitAria: string;
		fullscreenEnterAria: string;
		settingsTitle: string;
		settingsAria: string;
	};
	settings: {
		sectionLanguage: string;
		sectionDisplay: string;
		fullscreenActive: string;
		fullscreenInactive: string;
		sectionTheme: string;
		themeDark: string;
		themeLight: string;
		themeAmoled: string;
		themeAuto: string;
		sectionMarquee: string;
		marqueeSlow: string;
		marqueeSlowDesc: string;
		marqueeNormal: string;
		marqueeNormalDesc: string;
		marqueeFast: string;
		marqueeFastDesc: string;
		marqueeLimit: string;
		marqueeAria: string;
		marqueeFastLabel: string;
		marqueeSlowLabel: string;
		sectionClock: string;
		clockFormat: string;
		clock24hAria: string;
		clock12hAria: string;
		clockSeconds: string;
		secondsShown: string;
		secondsHidden: string;
		secondsHideAria: string;
		secondsShowAria: string;
		clockTimezone: string;
		timezoneSelectAria: string;
		sectionHelp: string;
		openHelp: string;
	};
	helpModal: {
		title: string;
		subtitle: string;
		closeAria: string;
		closeBtn: string;
		tip: string;
	};
	incidentBar: {
		noIncidents: string;
		incidentsCount: string;
		inQueue: string;
		inQueueTooltip: string;
		expandAria: string;
		collapseAria: string;
		pauseMarquee: string;
		resumeMarquee: string;
	};
	detailModal: {
		closeAria: string;
		closeBtn: string;
		currentStatus: string;
		downSince: string;
		recent: string;
		latency: string;
		uptime24h: string;
		uptime7d: string;
		criticality: string;
		recentHistory: string;
		outagesCount: string;
		fullyAvailable: string;
		twentyFourHoursAgo: string;
		now: string;
		availablePercent: string;
		hourlyAvailabilityAria: string;
		operational: string;
		degraded: string;
		down: string;
		kpiIncidents: string;
		kpiDowntime: string;
		kpiStreak: string;
		eventsLog: string;
		noInterruption: string;
		continuousOperation: string;
		ongoingOutage: string;
		resolvedOutage: string;
		instability: string;
		startedAt: string;
		resolvedAt: string;
		ongoingBadge: string;
		probeId: string;
		source: string;
		lastCheck: string;
	};
	probe: {
		cellAria: string;
		dotAria: string;
		uptime24h: string;
		latency: string;
	};
	pullToRefresh: {
		refreshing: string;
		release: string;
		pull: string;
	};
	login: {
		title: string;
		passwordLabel: string;
		passwordPlaceholder: string;
		unlock: string;
		invalidPassword: string;
		securityBadge: string;
	};
	skipLink: {
		navAria: string;
		mainContent: string;
		incidentBar: string;
	};
	keyboardHelp: {
		title: string;
		subtitle: string;
		closeAria: string;
		closeBtn: string;
		tip: string;
		navigateGrid: string;
		jumpFirstLast: string;
		openDetail: string;
		closeOrExit: string;
		toggleFullscreen: string;
		toggleMute: string;
		cycleTheme: string;
		toggleMarquee: string;
		navigateRegions: string;
		toggleHelp: string;
	};
	time: {
		secondShort: string;
		minuteShort: string;
		hourShort: string;
		dayShort: string;
		todayAt: string;
		yesterdayAt: string;
	};
}

/**
 * Utility type to extract dot-notated nested keys (e.g. 'common.loading', 'header.scoreAria').
 */
export type NestedKeyOf<ObjectType extends object> = {
	[Key in keyof ObjectType & (string | number)]: ObjectType[Key] extends object
		? `${Key}.${NestedKeyOf<ObjectType[Key]>}`
		: `${Key}`;
}[keyof ObjectType & (string | number)];

export type TranslationKey = NestedKeyOf<TranslationSchema>;
