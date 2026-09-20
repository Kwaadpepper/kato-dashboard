import type { MonitoringAdapter } from '$lib/types';

let activeAdapter: MonitoringAdapter | null = null;

/**
 * Registers active monitoring adapter for the server instance.
 */
export function setActiveAdapter(adapter: MonitoringAdapter): void {
	activeAdapter = adapter;
}

/**
 * Retrieves current active monitoring adapter.
 */
export function getActiveAdapter(): MonitoringAdapter | null {
	return activeAdapter;
}
