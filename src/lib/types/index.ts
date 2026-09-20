// ============================================================================
// LOCALIZATION & I18N
// ============================================================================

/**
 * Languages supported by the Kato application.
 */
export type SupportedLocale = 'en' | 'fr';

// ============================================================================
// STATUS & CRITICALITY
// ============================================================================

/**
 * The 6 possible operational statuses of a monitored probe.
 * - `up`: Operational service, checks passing.
 * - `down`: Service completely unreachable (high priority alert).
 * - `degraded`: High response time or intermittent failures.
 * - `paused`: Monitoring deliberately paused.
 * - `pending`: Probe registered, first health check pending.
 * - `maintenance`: Scheduled maintenance work in progress.
 */
export type ProbeStatus = 'up' | 'down' | 'degraded' | 'paused' | 'pending' | 'maintenance';

/**
 * Operational criticality levels for a probe.
 * Drives smart sort ordering and alert dispatch priority.
 * - `critical`: Mission-critical component (e.g. core API, payment gateway).
 * - `high`: Primary user-facing service with significant impact.
 * - `medium`: Supporting service or service with redundancy.
 * - `low`: Internal tool or non-critical background worker.
 */
export type Criticality = 'critical' | 'high' | 'medium' | 'low';

// ============================================================================
// NORMALIZED DATA MODEL (Vendor-agnostic)
// ============================================================================

/**
 * Normalized probe — unified data model regardless of monitoring provider.
 */
export interface NormalizedProbe {
  /** Unique ID prefixed with provider name (e.g. "ur:12345", "mock:1") */
  id: string;
  /** Provider identifier ("uptimerobot" | "mock" | custom) */
  source: string;
  /** Human-readable probe name */
  name: string;
  /** Monitored URL or IP address */
  url: string;
  /** Current operational status */
  status: ProbeStatus;
  /** Latest response time in milliseconds, null if unavailable */
  responseTime: number | null;
  /** Calculated 24h uptime percentage (0-100), null if unavailable */
  uptime24h: number | null;
  /** Calculated 7d uptime percentage (0-100), null if unavailable */
  uptime7d: number | null;
  /** Timestamp of the last health check (ISO 8601 UTC) */
  lastCheck: string;
  /** Logical group or classification tag (null if uncategorized) */
  group: string | null;
  /** Operational criticality level */
  criticality: Criticality;
  /** ISO 8601 timestamp marking outage start when status is 'down' */
  downSince?: string;
}

/**
 * Normalized incident representing service outage or degradation.
 */
export interface NormalizedIncident {
  /** Unique incident ID (e.g. "inc:ur:7849102:1726738800") */
  id: string;
  /** Target probe ID (references NormalizedProbe.id) */
  probeId: string;
  /** Probe name for direct display without joining records */
  probeName: string;
  /** Incident category ('down' for total outage, 'degraded' for instability) */
  type: 'down' | 'degraded';
  /** Incident start timestamp (ISO 8601) */
  startedAt: string;
  /** Incident resolution timestamp (ISO 8601), null if still active */
  resolvedAt: string | null;
  /** Interruption duration in seconds, null while incident is ongoing */
  duration: number | null;
  /** Diagnostic cause or error details (HTTP status, error message), optional */
  cause?: string;
}

/**
 * Chronological probe status transition event (UP, DOWN, DEGRADED).
 */
export interface ProbeStatusEvent {
  /** Event identifier */
  id: string;
  /** Captured operational status */
  status: ProbeStatus;
  /** Event occurrence timestamp (ISO 8601) */
  timestamp: string;
  /** Resolution timestamp if applicable */
  resolvedAt?: string | null;
  /** Incident duration in seconds if applicable */
  duration?: number | null;
  /** Diagnostic cause (e.g. "HTTP 503", "Timeout"), optional */
  cause?: string;
}

/**
 * Hourly slot for the 24-hour availability history bar.
 */
export interface UptimeBarSlot {
  /** Slot index (0 = H-24, 23 = current hour) */
  index: number;
  /** Slot start timestamp (ISO 8601) */
  startTime: string;
  /** Slot end timestamp (ISO 8601) */
  endTime: string;
  /** Observed status across this hour */
  status: 'up' | 'down' | 'degraded' | 'paused' | 'empty';
  /** Formatted tooltip / accessibility label */
  label: string;
  /** Number of incidents overlapping this slot */
  incidentCount: number;
  /** Cumulative downtime in seconds during this slot */
  downtimeSeconds: number;
}

// ============================================================================
// DASHBOARD STATE
// ============================================================================

/**
 * Full dashboard state snapshot pushed during initial SSE handshake.
 */
export interface DashboardState {
  /** Complete list of monitored probes */
  probes: NormalizedProbe[];
  /** Active and recent incidents (sliding 24h window) */
  incidents: NormalizedIncident[];
  /** Last update timestamp (ISO 8601) */
  lastUpdate: string;
  /** Active provider source name */
  source: string;
  /** Default client configuration served by the BFF server */
  defaultSettings?: ClientDefaultSettings;
}

/**
 * State delta broadcast over SSE on data changes.
 */
export interface DashboardDelta {
  /** Probes with modified status or metrics */
  changed: NormalizedProbe[];
  /** Newly opened incidents */
  newIncidents: NormalizedIncident[];
  /** IDs of incidents that have been resolved */
  resolvedIncidentIds: string[];
  /** Update event timestamp (ISO 8601) */
  timestamp: string;
}

// ============================================================================
// REALTIME PROTOCOL (Server-Sent Events)
// ============================================================================

/**
 * Event names transported over the SSE connection.
 */
export type SSEEventType = 'init' | 'update' | 'heartbeat';

/**
 * Discriminated union of SSE events.
 */
export type SSEEvent =
  | { type: 'init'; data: DashboardState }
  | { type: 'update'; data: DashboardDelta }
  | { type: 'heartbeat'; data: { timestamp: string } };

// ============================================================================
// MONITORING ADAPTER CONTRACT
// ============================================================================

/**
 * Generic configuration dictionary passed to monitoring adapters.
 */
export interface AdapterConfig {
  [key: string]: string | number | boolean;
}

/**
 * Interface contract required for all monitoring adapters.
 */
export interface MonitoringAdapter {
  /** Unique adapter identifier (e.g. "mock", "uptimerobot") */
  readonly name: string;
  /** Initializes the adapter with provider configuration */
  initialize(config: AdapterConfig): Promise<void>;
  /** Fetches all probes mapped to the normalized data model */
  fetchProbes(): Promise<NormalizedProbe[]>;
  /** Fetches incidents occurring since a given timestamp */
  fetchIncidents(since: Date): Promise<NormalizedIncident[]>;
  /** Returns the recommended polling interval in milliseconds */
  getPollingInterval(): number;
  /** Optional probe-level history fetcher for detailed view */
  fetchProbeHistory?(probeId: string): Promise<NormalizedIncident[]>;
}

// ============================================================================
// APPLICATION CONFIGURATION
// ============================================================================

/**
 * Main application instance configuration.
 */
export interface KatoConfig {
  /** Active monitoring adapter */
  adapter: 'uptimerobot' | 'mock';
  /** Whether password protection is enabled */
  authEnabled: boolean;
  /** Master password hash/value (null when auth is disabled) */
  authPassword: string | null;
  /** HTTP server listen port */
  port: number;
  /** Network interface bind address */
  host: string;
}

/**
 * Configuration options specific to the Uptime Robot adapter.
 */
export interface UptimeRobotConfig extends AdapterConfig {
  /** Uptime Robot API Key */
  apiKey: string;
  /** Polling interval in milliseconds */
  pollInterval: number;
}

// ============================================================================
// CLIENT STATE & GRID ENGINE
// ============================================================================

/**
 * Visual density level for the probe grid.
 * - `large`: 1-12 probes (expanded view with full metrics).
 * - `medium`: 13-48 probes (name, response time, uptime, badge).
 * - `compact`: 49-120 probes (truncated name, dot, latency).
 * - `micro`: 121-300 probes (compact rectangular pill).
 * - `pixel`: 300+ probes (high-density heatmap matrix).
 */
export type GridDensity = 'large' | 'medium' | 'compact' | 'micro' | 'pixel';

/**
 * Visual color theme.
 * - `dark`: Default dark theme (slate background).
 * - `light`: High-contrast light theme.
 * - `amoled`: Pure black (#000000) for OLED / TV power saving.
 * - `auto`: Automatically follows OS color scheme.
 */
export type Theme = 'dark' | 'light' | 'amoled' | 'auto';

/**
 * Clock display format.
 * - `24h`: 24-hour clock (e.g. 14:30:00).
 * - `12h`: 12-hour AM/PM clock (e.g. 02:30:00 PM).
 */
export type TimeFormat = '24h' | '12h';

/**
 * Incident marquee scrolling speed preset.
 */
export type MarqueeSpeed = 'slow' | 'normal' | 'fast';

/**
 * Probe sorting mode.
 */
export type SortMode = 'smart' | 'alpha' | 'group';

/**
 * Default client configuration provided by the BFF server from environment variables.
 */
export interface ClientDefaultSettings {
  /** Default active language */
  locale: SupportedLocale;
  /** Default color theme */
  theme: Theme;
  /** Default clock format */
  timeFormat: TimeFormat;
  /** Default timezone ('local', 'UTC', or IANA identifier) */
  timeZone: string;
  /** Whether to show seconds in clock by default */
  showSeconds: boolean;
  /** Whether audio alerts are enabled by default */
  soundEnabled: boolean;
  /** Incident marquee scrolling speed */
  marqueeSpeed: MarqueeSpeed;
  /** Default probe sort mode */
  sortMode: SortMode;
}

/**
 * User preferences persisted client-side in LocalStorage.
 */
export interface UserPreferences {
  /** Active UI language */
  locale?: SupportedLocale;
  /** Selected theme */
  theme: Theme;
  /** Selected probe sort mode */
  sortMode: SortMode;
  /** Audio alerts toggle */
  soundEnabled: boolean;
  /** Auto-fullscreen in TV mode (?tv=1) */
  tvAutoFullscreen: boolean;
  /** Clock format (24h or 12h) */
  timeFormat?: TimeFormat;
  /** Timezone (e.g. 'local', 'UTC', 'America/New_York') */
  timeZone?: string;
  /** Seconds display toggle */
  showSeconds?: boolean;
  /** Incident marquee scrolling speed */
  marqueeSpeed?: MarqueeSpeed;
}

/**
 * Input parameters for the adaptive grid calculation algorithm.
 */
export interface GridInput {
  /** Available container or viewport width in pixels */
  viewportWidth: number;
  /** Available container or viewport height in pixels */
  viewportHeight: number;
  /** Total number of probes to arrange */
  probeCount: number;
  /** Header bar reserved height (standard 48px) */
  headerHeight?: number;
  /** Incident bar reserved height (standard 40px) */
  incidentBarHeight?: number;
  /** Enforce mobile touch target constraint (minimum 44px cells) */
  isMobile?: boolean;
  /** Force zero-scroll layout with packed pixels even on small screens */
  forceZeroScroll?: boolean;
}

/**
 * Dynamically calculated grid layout parameters.
 */
export interface GridLayout {
  /** Determined visual density */
  density: GridDensity;
  /** Number of grid columns */
  columns: number;
  /** Number of grid rows */
  rows: number;
  /** Cell dimension in pixels */
  cellSize: number;
  /** Inter-cell gap in pixels */
  gap: number;
  /** Indicates whether vertical scrolling is required (e.g. 44px mobile touch mode) */
  overflows?: boolean;
}
