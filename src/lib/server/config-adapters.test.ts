import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getAppConfig, loadAdaptersConfig } from './config.ts';

describe('Adapter Configuration Parser', () => {
	it('should return mock adapter by default when env is empty', () => {
		const configs = loadAdaptersConfig({});
		assert.equal(configs.length, 1);
		assert.equal(configs[0].type, 'mock');
		assert.equal(configs[0].id, 'mock');
		if (configs[0].type === 'mock') {
			assert.equal(configs[0].count, 50);
		}
	});

	it('should support legacy single KATO_ADAPTER=uptimerobot', () => {
		const configs = loadAdaptersConfig({
			KATO_ADAPTER: 'uptimerobot',
			UPTIMEROBOT_API_KEY: 'test-key',
			UPTIMEROBOT_POLL_INTERVAL: '15000'
		});
		assert.equal(configs.length, 1);
		assert.equal(configs[0].type, 'uptimerobot');
		assert.equal(configs[0].id, 'uptimerobot');
		if (configs[0].type === 'uptimerobot') {
			assert.equal(configs[0].apiKey, 'test-key');
			assert.equal(configs[0].pollInterval, 15000);
		}
	});

	it('should support legacy comma-separated KATO_ADAPTER=uptimerobot,uptimekuma', () => {
		const configs = loadAdaptersConfig({
			KATO_ADAPTER: 'uptimerobot,uptimekuma',
			UPTIMEROBOT_API_KEY: 'ur-key',
			UPTIME_KUMA_URL: 'https://kuma.example.com',
			UPTIME_KUMA_API_KEY: 'kuma-key'
		});
		assert.equal(configs.length, 2);
		assert.equal(configs[0].type, 'uptimerobot');
		assert.equal(configs[1].type, 'uptimekuma');
		if (configs[1].type === 'uptimekuma') {
			assert.equal(configs[1].baseUrl, 'https://kuma.example.com');
			assert.equal(configs[1].apiKey, 'kuma-key');
			assert.equal(configs[1].pollInterval, 60000);
		}
	});

	it('should support named instances via KATO_ADAPTERS', () => {
		const configs = loadAdaptersConfig({
			KATO_ADAPTERS: 'kuma_prod, kuma_lan, robot_main',
			ADAPTER_KUMA_PROD_TYPE: 'uptimekuma',
			ADAPTER_KUMA_PROD_URL: 'https://kuma-prod.acme.com',
			ADAPTER_KUMA_PROD_API_KEY: 'token-prod',
			ADAPTER_KUMA_PROD_POLL_INTERVAL: '30000',

			ADAPTER_KUMA_LAN_TYPE: 'uptimekuma',
			ADAPTER_KUMA_LAN_URL: 'http://192.168.1.100:3001',
			ADAPTER_KUMA_LAN_POLL_INTERVAL: '10000',

			ADAPTER_ROBOT_MAIN_TYPE: 'uptimerobot',
			ADAPTER_ROBOT_MAIN_API_KEY: 'u-robot-key',
			ADAPTER_ROBOT_MAIN_POLL_INTERVAL: '45000'
		});

		assert.equal(configs.length, 3);

		// kuma_prod
		assert.equal(configs[0].id, 'kuma_prod');
		assert.equal(configs[0].type, 'uptimekuma');
		if (configs[0].type === 'uptimekuma') {
			assert.equal(configs[0].baseUrl, 'https://kuma-prod.acme.com');
			assert.equal(configs[0].apiKey, 'token-prod');
			assert.equal(configs[0].pollInterval, 30000);
		}

		// kuma_lan
		assert.equal(configs[1].id, 'kuma_lan');
		assert.equal(configs[1].type, 'uptimekuma');
		if (configs[1].type === 'uptimekuma') {
			assert.equal(configs[1].baseUrl, 'http://192.168.1.100:3001');
			assert.equal(configs[1].apiKey, undefined);
			assert.equal(configs[1].pollInterval, 10000);
		}

		// robot_main
		assert.equal(configs[2].id, 'robot_main');
		assert.equal(configs[2].type, 'uptimerobot');
		if (configs[2].type === 'uptimerobot') {
			assert.equal(configs[2].apiKey, 'u-robot-key');
			assert.equal(configs[2].pollInterval, 45000);
		}
	});

	it('should infer provider type from alias name if ADAPTER_<ID>_TYPE is omitted', () => {
		const configs = loadAdaptersConfig({
			KATO_ADAPTERS: 'kuma_office, robot_secondary, demo_mock',
			ADAPTER_KUMA_OFFICE_URL: 'https://office-kuma.lan',
			ADAPTER_ROBOT_SECONDARY_API_KEY: 'key-sec',
			ADAPTER_DEMO_MOCK_COUNT: '25'
		});

		assert.equal(configs.length, 3);
		assert.equal(configs[0].type, 'uptimekuma');
		assert.equal(configs[1].type, 'uptimerobot');
		assert.equal(configs[2].type, 'mock');
		if (configs[2].type === 'mock') {
			assert.equal(configs[2].count, 25);
		}
	});

	it('should build global getAppConfig with default values', () => {
		const appConfig = getAppConfig({
			PORT: '8080',
			HOST: '127.0.0.1',
			KATO_AUTH_ENABLED: 'true',
			KATO_AUTH_PASSWORD: 'supersecretpassword'
		});

		assert.equal(appConfig.port, 8080);
		assert.equal(appConfig.host, '127.0.0.1');
		assert.equal(appConfig.authEnabled, true);
		assert.equal(appConfig.authPassword, 'supersecretpassword');
		assert.equal(appConfig.adapters.length, 1);
		assert.equal(appConfig.adapters[0].type, 'mock');
	});
});
