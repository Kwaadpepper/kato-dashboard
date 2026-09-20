import type {
    AdapterConfig,
    MonitoringAdapter,
    NormalizedIncident,
    NormalizedProbe,
    ProbeStatus
} from '$lib/types';

/** Parsed line from the Prometheus /metrics endpoint */
interface ParsedMetric {
	name: string;
	type: string;
	url: string;
	value: number;
}

interface ActiveIncidentInfo {
	incidentId: string;
	startedAt: string;
	probeName: string;
}

interface RequestError extends Error {
	status?: number;
	isAuthError?: boolean;
	isTimeout?: boolean;
}

/**
 * UptimeKuma adapter for Kato Dashboard — uses the Prometheus /metrics endpoint.
 *
 * Implements MonitoringAdapter:
 * - Bearer token auth via UPTIME_KUMA_API_KEY (required if an API key has been created,
 *   as UptimeKuma permanently disables basic auth once the first API key is added)
 * - Parses monitor_status and monitor_response_time Prometheus metrics
 * - In-memory outage tracking (active and resolved incidents)
 * - Fault tolerance: network errors preserve last known state
 */
export class UptimeKumaAdapter implements MonitoringAdapter {
	readonly name = 'uptimekuma';

	private config: AdapterConfig = {};
	private apiKey = '';
	private baseUrl = '';

	/** Last known probes cache (served on network outage) */
	private cachedProbes: Map<string, NormalizedProbe> = new Map();

	/** In-memory active incidents registry (currently DOWN monitors) */
	private readonly downMonitors: Map<string, ActiveIncidentInfo> = new Map();

	/** Rolling history of resolved incidents (max 24h) */
	private resolvedIncidents: NormalizedIncident[] = [];

	/**
	 * Initializes adapter with provided configuration.
	 *
	 * - Reads base URL from config.baseUrl or process.env.UPTIME_KUMA_URL (required)
	 * - Reads API key from config.apiKey or process.env.UPTIME_KUMA_API_KEY
	 * - Validates connectivity with GET /metrics
	 */
	async initialize(config: AdapterConfig): Promise<void> {
		this.config = config;

		const baseUrl = String(config.baseUrl || process.env.UPTIME_KUMA_URL || '').replace(/\/$/,'');
		if (!baseUrl) {
			throw new Error('Missing configuration: UPTIME_KUMA_URL is required.');
		}
		this.baseUrl = baseUrl;

		this.apiKey = String(config.apiKey || process.env.UPTIME_KUMA_API_KEY || '').trim();

		try {
			const text = await this.fetchMetricsText();
			const statuses = this.parseMetricLines(text, 'monitor_status');
			console.log(`[UptimeKuma] Connected to ${baseUrl}. Monitors found: ${Object.keys(statuses).length}`);
		} catch (err: unknown) {
			const reqErr = err as RequestError;
			if (reqErr?.isAuthError) return;
			console.warn('[UptimeKuma] Warning during initial validation:', reqErr?.message || String(err));
		}
	}

	/**
	 * Fetches all probes by parsing the Prometheus /metrics endpoint.
	 */
	async fetchProbes(): Promise<NormalizedProbe[]> {
		try {
			const text = await this.fetchMetricsText();
			const statuses = this.parseMetricLines(text, 'monitor_status');
			const responseTimes = this.parseMetricLines(text, 'monitor_response_time');

			const nowIso = new Date().toISOString();
			const newProbesMap = new Map<string, NormalizedProbe>();
			const currentDownIds = new Set<string>();

			for (const [key, metric] of Object.entries(statuses)) {
				const probeId = `uk:${key}`;
				const status: ProbeStatus = metric.value === 1 ? 'up' : 'down';
				const responseTime = responseTimes[key]?.value ?? null;

				this.trackIncidentState(probeId, metric.name, status, nowIso);
				if (status === 'down') currentDownIds.add(probeId);

				const downSince = this.downMonitors.get(probeId)?.startedAt;

				newProbesMap.set(probeId, {
					id: probeId,
					source: this.name,
					name: metric.name,
					url: metric.url,
					status,
					responseTime,
					uptime24h: null,
					uptime7d: null,
					lastCheck: nowIso,
					group: null,
					criticality: 'medium',
					...(downSince ? { downSince } : {})
				});
			}

			for (const downId of this.downMonitors.keys()) {
				if (!currentDownIds.has(downId)) this.downMonitors.delete(downId);
			}

			this.cachedProbes = newProbesMap;
			return Array.from(this.cachedProbes.values());
		} catch (err: unknown) {
			const reqErr = err as RequestError;
			if (reqErr?.isTimeout) {
				console.warn('[UptimeKuma] Timeout reached during polling, preserving last known state.');
			} else {
				console.warn(
					'[UptimeKuma] Network down or API error, preserving last known state:',
					reqErr?.message || String(err)
				);
			}
			return Array.from(this.cachedProbes.values());
		}
	}

	/** Returns active and recently resolved incidents from in-memory tracking. */
	async fetchIncidents(since: Date): Promise<NormalizedIncident[]> {
		const sinceMs = since.getTime();
		const incidents: NormalizedIncident[] = [];

		for (const [probeId, downInfo] of this.downMonitors.entries()) {
			incidents.push({
				id: downInfo.incidentId,
				probeId,
				probeName: downInfo.probeName,
				type: 'down',
				startedAt: downInfo.startedAt,
				resolvedAt: null,
				duration: null
			});
		}

		for (const resolved of this.resolvedIncidents) {
			const startedMs = new Date(resolved.startedAt).getTime();
			const resolvedMs = resolved.resolvedAt ? new Date(resolved.resolvedAt).getTime() : 0;
			if (startedMs >= sinceMs || resolvedMs >= sinceMs) {
				incidents.push({ ...resolved });
			}
		}

		const cutoff24h = Date.now() - 24 * 60 * 60 * 1000;
		this.resolvedIncidents = this.resolvedIncidents.filter((inc) => {
			if (!inc.resolvedAt) return true;
			return new Date(inc.resolvedAt).getTime() >= cutoff24h;
		});

		return incidents.sort(
			(a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
		);
	}

	/** Returns in-memory incident history for a specific probe. */
	async fetchProbeHistory(probeId: string): Promise<NormalizedIncident[]> {
		const incidents: NormalizedIncident[] = [];

		const active = this.downMonitors.get(probeId);
		if (active) {
			incidents.push({
				id: active.incidentId,
				probeId,
				probeName: active.probeName,
				type: 'down',
				startedAt: active.startedAt,
				resolvedAt: null,
				duration: null,
				cause: 'Confirmed ongoing outage'
			});
		}

		for (const resolved of this.resolvedIncidents) {
			if (resolved.probeId === probeId) incidents.push({ ...resolved });
		}

		return incidents.sort(
			(a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
		);
	}

	/**
	 * Recommended polling interval in milliseconds.
	 * Reads UPTIME_KUMA_POLL_INTERVAL or defaults to 60000ms.
	 */
	getPollingInterval(): number {
		const envVal = process.env.UPTIME_KUMA_POLL_INTERVAL;
		if (envVal) {
			const parsed = Number.parseInt(envVal, 10);
			if (!Number.isNaN(parsed) && parsed > 0) return parsed;
		}
		if (typeof this.config.pollInterval === 'number' && this.config.pollInterval > 0) {
			return this.config.pollInterval;
		}
		return 60_000;
	}

	// ============================================================================
	// PRIVATE METHODS
	// ============================================================================

	private trackIncidentState(
		probeId: string,
		probeName: string,
		status: ProbeStatus,
		nowIso: string
	): void {
		if (status === 'down') {
			if (!this.downMonitors.has(probeId)) {
				this.downMonitors.set(probeId, {
					incidentId: `uk:inc:${probeId}:${Date.now()}`,
					startedAt: nowIso,
					probeName
				});
			}
		} else if (this.downMonitors.has(probeId)) {
			const downInfo = this.downMonitors.get(probeId)!;
			const startMs = new Date(downInfo.startedAt).getTime();
			const endMs = new Date(nowIso).getTime();
			const duration = Math.max(1, Math.round((endMs - startMs) / 1000));

			this.resolvedIncidents.push({
				id: downInfo.incidentId,
				probeId,
				probeName: downInfo.probeName,
				type: 'down',
				startedAt: downInfo.startedAt,
				resolvedAt: nowIso,
				duration
			});
			this.downMonitors.delete(probeId);
		}
	}

	private async fetchMetricsText(): Promise<string> {
		return this.request('/metrics');
	}

	/**
	 * Parses Prometheus text-format lines for a given metric name.
	 * Returns a map keyed by URL-encoded monitor_name.
	 *
	 * Example line:
	 *   monitor_status{monitor_name="My Site",monitor_type="http",monitor_url="https://..."} 1
	 */
	private parseMetricLines(text: string, metricName: string): Record<string, ParsedMetric> {
		const result: Record<string, ParsedMetric> = {};
		const prefix = `${metricName}{`;

		for (const line of text.split('\n')) {
			if (!line.startsWith(prefix)) continue;

			const closeBrace = line.indexOf('}');
			if (closeBrace === -1) continue;

			const labelStr = line.slice(prefix.length, closeBrace);
			const afterBrace = line.slice(closeBrace + 1).trimStart();
			const spaceIdx = afterBrace.indexOf(' ');
			const valueStr = spaceIdx === -1 ? afterBrace : afterBrace.slice(0, spaceIdx);
			const value = Number.parseFloat(valueStr);
			if (Number.isNaN(value)) continue;

			const labels = this.parseLabels(labelStr);
			const name = labels['monitor_name'] || '';
			if (!name) continue;

			const portSuffix = labels['monitor_port'] ? `:${labels['monitor_port']}` : '';
			const url =
				labels['monitor_url'] ||
				(labels['monitor_hostname'] ? `${labels['monitor_hostname']}${portSuffix}` : '');

			result[encodeURIComponent(name)] = {
				name,
				type: labels['monitor_type'] || '',
				url,
				value
			};
		}

		return result;
	}

	/** Parses a Prometheus label string `key="val",key2="val2"` into a plain object. */
	private parseLabels(labelStr: string): Record<string, string> {
		const labels: Record<string, string> = {};
		let remaining = labelStr;

		while (remaining.length > 0) {
			const eqIdx = remaining.indexOf('="');
			if (eqIdx === -1) break;

			const key = remaining.slice(0, eqIdx).trim();
			remaining = remaining.slice(eqIdx + 2);

			const closeQuote = remaining.indexOf('"');
			if (closeQuote === -1) break;

			labels[key] = remaining.slice(0, closeQuote);
			remaining = remaining.slice(closeQuote + 1);
			if (remaining.startsWith(',')) remaining = remaining.slice(1);
		}

		return labels;
	}

	/**
	 * Executes an HTTP GET to /metrics and returns the raw Prometheus text body.
	 * - Bearer token auth when UPTIME_KUMA_API_KEY is set
	 * - 10s timeout with one automatic retry on abort
	 * - 401/403: logs error and does not crash
	 */
	private async request(path: string, attempt = 1): Promise<string> {
		const url = `${this.baseUrl}${path}`;
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), 10_000);

		try {
			const headers: Record<string, string> = { Accept: 'text/plain' };
			if (this.apiKey) {
				// UptimeKuma uses Basic Auth with empty username and API key as password
				const encoded = Buffer.from(`:${this.apiKey}`).toString('base64');
				headers['Authorization'] = `Basic ${encoded}`;
			}

			const response = await fetch(url, { method: 'GET', headers, signal: controller.signal });
			clearTimeout(timeoutId);

			if (response.status === 401 || response.status === 403) {
				console.error(
					`[UptimeKuma] Unauthorized (${response.status}) — check UPTIME_KUMA_API_KEY.`
				);
				const err = new Error(`HTTP ${response.status}: Unauthorized`) as RequestError;
				err.status = response.status;
				err.isAuthError = true;
				throw err;
			}

			if (!response.ok) {
				const err = new Error(`HTTP ${response.status}: ${response.statusText}`) as RequestError;
				err.status = response.status;
				throw err;
			}

			return response.text();
		} catch (err: unknown) {
			clearTimeout(timeoutId);
			const reqErr = err as RequestError;
			if (reqErr?.isAuthError) throw err;

			if (reqErr?.name === 'AbortError') {
				if (attempt < 2) {
					console.warn(`[UptimeKuma] Timeout on ${path}, retrying...`);
					return this.request(path, attempt + 1);
				}
				const timeoutErr = new Error('Request timed out after retry') as RequestError;
				timeoutErr.isTimeout = true;
				throw timeoutErr;
			}

			throw err;
		}
	}
}
