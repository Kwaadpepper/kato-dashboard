import type { MonitoringAdapter } from '$lib/types';
import type { DashboardStore } from './store';

const adapterRegistry: Map<string, MonitoringAdapter> = new Map();
let activeAdapter: MonitoringAdapter | null = null;

/**
 * Registers an adapter instance in the server registry.
 */
export function registerAdapter(adapter: MonitoringAdapter): void {
	adapterRegistry.set(adapter.name, adapter);
	if (!activeAdapter) {
		activeAdapter = adapter;
	}
}

/**
 * Registers active monitoring adapter for the server instance (legacy compatibility).
 */
export function setActiveAdapter(adapter: MonitoringAdapter): void {
	activeAdapter = adapter;
	adapterRegistry.set(adapter.name, adapter);
}

/**
 * Retrieves current active monitoring adapter (primary or first registered).
 */
export function getActiveAdapter(): MonitoringAdapter | null {
	return activeAdapter;
}

/**
 * Retrieves an adapter by its unique name / alias.
 */
export function getAdapterByName(name: string): MonitoringAdapter | undefined {
	return adapterRegistry.get(name);
}

/**
 * Retrieves all registered adapters.
 */
export function getAllAdapters(): MonitoringAdapter[] {
	return Array.from(adapterRegistry.values());
}

/**
 * Resolves the appropriate adapter instance for a given probe ID.
 *
 * Strategy:
 * 1. Store lookup: Check probe.source in the store.
 * 2. Prefix match: Probe IDs follow "<instanceOrPrefix>:<id>". Match prefix to adapter name.
 * 3. Default legacy prefix match:
 *    - "ur" -> adapter named "uptimerobot" or type "uptimerobot"
 *    - "uk" -> adapter named "uptimekuma" or type "uptimekuma"
 *    - "mock" -> adapter named "mock" or type "mock"
 * 4. Fallback: return activeAdapter.
 */
export function getAdapterForProbe(
	probeId: string,
	store?: Pick<DashboardStore, 'getProbe'>
): MonitoringAdapter | null {
	// 1. Store lookup
	if (store && typeof store.getProbe === 'function') {
		const probe = store.getProbe(probeId);
		if (probe?.source) {
			const direct = adapterRegistry.get(probe.source);
			if (direct) return direct;
		}
	}

	// 2. Direct prefix matching
	const colonIndex = probeId.indexOf(':');
	if (colonIndex > 0) {
		const prefix = probeId.substring(0, colonIndex);
		const byPrefix = adapterRegistry.get(prefix);
		if (byPrefix) return byPrefix;

		// 3. Known default abbreviations
		if (prefix === 'ur') {
			const ur =
				adapterRegistry.get('uptimerobot') ??
				Array.from(adapterRegistry.values()).find((a) => a.type === 'uptimerobot');
			if (ur) return ur;
		} else if (prefix === 'uk') {
			const uk =
				adapterRegistry.get('uptimekuma') ??
				Array.from(adapterRegistry.values()).find((a) => a.type === 'uptimekuma');
			if (uk) return uk;
		} else if (prefix === 'mock') {
			const mock =
				adapterRegistry.get('mock') ??
				Array.from(adapterRegistry.values()).find((a) => a.type === 'mock');
			if (mock) return mock;
		}
	}

	// 4. Fallback
	return activeAdapter;
}

/**
 * Clears the registry (useful in test teardown).
 */
export function clearAdapters(): void {
	adapterRegistry.clear();
	activeAdapter = null;
}
