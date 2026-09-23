import type { AdapterInstanceConfig, MonitoringAdapter } from '$lib/types';
import { MockAdapter } from './mock.adapter';
import { UptimeKumaAdapter } from './uptime-kuma.adapter';
import { UptimeRobotAdapter } from './uptime-robot.adapter';

/**
 * Creates and initializes a MonitoringAdapter based on its strongly-typed configuration.
 *
 * @param config Strongly-typed instance configuration
 * @returns Fully initialized monitoring adapter ready for polling
 */
export async function createAndInitAdapter(
	config: AdapterInstanceConfig
): Promise<MonitoringAdapter> {
	switch (config.type) {
		case 'mock': {
			const adapter = new MockAdapter(config.id);
			await adapter.initialize({
				count: config.count ?? 50,
				pollInterval: config.pollInterval
			});
			return adapter;
		}

		case 'uptimerobot': {
			const adapter = new UptimeRobotAdapter(config.id);
			await adapter.initialize({
				apiKey: config.apiKey,
				pollInterval: config.pollInterval ?? 30000
			});
			return adapter;
		}

		case 'uptimekuma': {
			const adapter = new UptimeKumaAdapter(config.id);
			await adapter.initialize({
				baseUrl: config.baseUrl,
				apiKey: config.apiKey ?? '',
				pollInterval: config.pollInterval ?? 60000
			});
			return adapter;
		}

		default: {
			const exhaustiveCheck: never = config;
			throw new Error(`Unsupported adapter configuration: ${JSON.stringify(exhaustiveCheck)}`);
		}
	}
}
