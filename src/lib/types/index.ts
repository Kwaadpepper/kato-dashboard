// ============================================================================
// LOCALISATION ET I18N
// ============================================================================

/**
 * Langues supportées par l'application Kato.
 */
export type SupportedLocale = 'fr' | 'en';

// ============================================================================
// STATUTS ET CRITICITÉ
// ============================================================================

/**
 * Les 6 statuts possibles d'une sonde de surveillance.
 * - `up` : Service opérationnel, contrôles valides.
 * - `down` : Service totalement indisponible (alerte prioritaire).
 * - `degraded` : Temps de réponse excessif ou instabilité.
 * - `paused` : Surveillance suspendue volontairement.
 * - `pending` : Sonde créée mais premier check en attente.
 * - `maintenance` : Travaux programmés en cours.
 */
export type ProbeStatus = 'up' | 'down' | 'degraded' | 'paused' | 'pending' | 'maintenance';

/**
 * Niveaux de criticité opérationnelle d'une sonde.
 * Conditionne le tri intelligent (smart sort) et la priorité des alertes.
 * - `critical` : Composant vital (ex. API centrale, passerelle de paiement).
 * - `high` : Service principal à fort impact utilisateur.
 * - `medium` : Service intermédiaire ou avec redondance.
 * - `low` : Service secondaire ou interne.
 */
export type Criticality = 'critical' | 'high' | 'medium' | 'low';

// ============================================================================
// MODÈLE NORMALISÉ (indépendant de la source)
// ============================================================================

/**
 * Sonde normalisée — modèle unifié quelle que soit la source de monitoring.
 */
export interface NormalizedProbe {
  /** ID unique préfixé par la source (ex: "ur:12345", "mock:1") */
  id: string;
  /** Identifiant du fournisseur source ("uptimerobot" | "hetrix" | "mock") */
  source: string;
  /** Nom lisible de la sonde */
  name: string;
  /** URL ou adresse IP monitorée */
  url: string;
  /** Statut opérationnel actuel */
  status: ProbeStatus;
  /** Temps de réponse en ms (dernière mesure), null si indisponible */
  responseTime: number | null;
  /** Uptime calculé sur les dernières 24h (0-100), null si indisponible */
  uptime24h: number | null;
  /** Uptime calculé sur les 7 derniers jours (0-100), null si indisponible */
  uptime7d: number | null;
  /** Horodatage du dernier check (format ISO 8601 UTC) */
  lastCheck: string;
  /** Groupe ou tag de classement logique (null si aucun) */
  group: string | null;
  /** Niveau de criticité opérationnelle */
  criticality: Criticality;
  /** Horodatage ISO 8601 du début de panne si statut == 'down' */
  downSince?: string;
}

/**
 * Incident normalisé représentant une indisponibilité ou une dégradation de service.
 */
export interface NormalizedIncident {
  /** ID unique de l'incident (ex: "inc:ur:7849102:1726738800") */
  id: string;
  /** ID de la sonde concernée (référence NormalizedProbe.id) */
  probeId: string;
  /** Nom de la sonde pour affichage direct sans recherche jointe */
  probeName: string;
  /** Type d'incident ('down' pour panne complète, 'degraded' pour instabilité) */
  type: 'down' | 'degraded';
  /** Date et heure de début de l'incident (format ISO 8601) */
  startedAt: string;
  /** Date et heure de rétablissement (format ISO 8601), null si toujours actif */
  resolvedAt: string | null;
  /** Durée d'interruption en secondes, null si l'incident est toujours en cours */
  duration: number | null;
  /** Motif ou détail de l'incident (code HTTP, message d'erreur), optionnel */
  cause?: string;
}

/**
 * Événement chronologique d'historique de statut d'une sonde (UP, DOWN, DEGRADED).
 */
export interface ProbeStatusEvent {
  /** ID de l'événement */
  id: string;
  /** Statut représenté */
  status: ProbeStatus;
  /** Date et heure de déclenchement (format ISO 8601) */
  timestamp: string;
  /** Date et heure de résolution si applicable */
  resolvedAt?: string | null;
  /** Durée de l'incident en secondes si applicable */
  duration?: number | null;
  /** Motif ou détail explicatif (ex: "HTTP 503", "Timeout"), optionnel */
  cause?: string;
}

/**
 * Créneau horaire de la barre de disponibilité 24h.
 */
export interface UptimeBarSlot {
  /** Index du créneau (0 = H-24, 23 = heure actuelle) */
  index: number;
  /** Date/heure de début du créneau (ISO 8601) */
  startTime: string;
  /** Date/heure de fin du créneau (ISO 8601) */
  endTime: string;
  /** Statut effectif constaté sur le créneau */
  status: 'up' | 'down' | 'degraded' | 'paused' | 'empty';
  /** Libellé formaté pour infobulle / accessibilité */
  label: string;
  /** Nombre d'incidents ayant impacté ce créneau */
  incidentCount: number;
  /** Durée cumulée d'indisponibilité sur ce créneau en secondes */
  downtimeSeconds: number;
}

// ============================================================================
// ÉTAT DU DASHBOARD
// ============================================================================

/**
 * État global complet du dashboard transmis lors de l'initialisation SSE.
 */
export interface DashboardState {
  /** Liste complète de toutes les sondes supervisées */
  probes: NormalizedProbe[];
  /** Incidents actifs et récents (fenêtre glissante des dernières 24h) */
  incidents: NormalizedIncident[];
  /** Date et heure de dernière mise à jour (format ISO 8601) */
  lastUpdate: string;
  /** Nom du fournisseur source actif */
  source: string;
  /** Réglages client par défaut transmis par le serveur BFF */
  defaultSettings?: ClientDefaultSettings;
}

/**
 * Différentiel d'état envoyé par flux SSE lors des modifications.
 */
export interface DashboardDelta {
  /** Liste des sondes dont le statut ou les métriques ont changé */
  changed: NormalizedProbe[];
  /** Nouveaux incidents ouverts */
  newIncidents: NormalizedIncident[];
  /** Identifiants des incidents désormais résolus */
  resolvedIncidentIds: string[];
  /** Horodatage de l'événement de mise à jour (format ISO 8601) */
  timestamp: string;
}

// ============================================================================
// PROTOCOLE TEMPS RÉEL (Server-Sent Events)
// ============================================================================

/**
 * Identifiants des types d'événements transportés via SSE.
 */
export type SSEEventType = 'init' | 'update' | 'heartbeat';

/**
 * Événement SSE typé sous la forme d'une union discriminée.
 */
export type SSEEvent =
  | { type: 'init'; data: DashboardState }
  | { type: 'update'; data: DashboardDelta }
  | { type: 'heartbeat'; data: { timestamp: string } };

// ============================================================================
// CONTRAT DES ADAPTATEURS DE MONITORING
// ============================================================================

/**
 * Dictionnaire de configuration générique transmis aux adaptateurs.
 */
export interface AdapterConfig {
  [key: string]: string | number | boolean;
}

/**
 * Contrat d'interface que chaque adaptateur de source de monitoring doit implémenter.
 */
export interface MonitoringAdapter {
  /** Nom unique de l'adaptateur (ex: "mock", "uptimerobot") */
  readonly name: string;
  /** Initialise l'adaptateur avec sa configuration spécifique */
  initialize(config: AdapterConfig): Promise<void>;
  /** Récupère la liste intégrale des sondes sous le format normalisé */
  fetchProbes(): Promise<NormalizedProbe[]>;
  /** Récupère la liste des incidents survenus depuis une date donnée */
  fetchIncidents(since: Date): Promise<NormalizedIncident[]>;
  /** Retourne l'intervalle de rafraîchissement (polling) recommandé en millisecondes */
  getPollingInterval(): number;
  /** Récupère l'historique récent des événements/incidents pour une sonde spécifique (optionnel) */
  fetchProbeHistory?(probeId: string): Promise<NormalizedIncident[]>;
}

// ============================================================================
// CONFIGURATION DE L'APPLICATION
// ============================================================================

/**
 * Configuration principale de l'instance de l'application Kato.
 */
export interface KatoConfig {
  /** Adaptateur de monitoring activé */
  adapter: 'uptimerobot' | 'mock';
  /** Indique si le contrôle d'accès par mot de passe est activé */
  authEnabled: boolean;
  /** Mot de passe de protection de l'accès (null si désactivé) */
  authPassword: string | null;
  /** Port d'écoute du serveur HTTP */
  port: number;
  /** Adresse d'écoute de l'interface réseau du serveur */
  host: string;
}

/**
 * Paramètres de configuration spécifiques à l'adaptateur Uptime Robot.
 */
export interface UptimeRobotConfig extends AdapterConfig {
  /** Clé API Uptime Robot */
  apiKey: string;
  /** Intervalle de scrutation de l'API en millisecondes */
  pollInterval: number;
}

// ============================================================================
// ÉTAT CLIENT ET MOTEUR DE GRILLE
// ============================================================================

/**
 * Niveau de densité de présentation de la grille de sondes.
 * - `large` : 1 à 12 sondes (affichage complet avec sparklines).
 * - `medium` : 13 à 48 sondes (nom, temps, uptime, badge).
 * - `compact` : 49 à 120 sondes (nom raccourci, pastille, temps ms).
 * - `micro` : 121 à 300 sondes (pastille compacte rectangulaire).
 * - `pixel` : 300+ sondes (matrice dense type heatmap).
 */
export type GridDensity = 'large' | 'medium' | 'compact' | 'micro' | 'pixel';

/**
 * Thème d'affichage de l'interface utilisateur.
 * - `dark` : Thème sombre par défaut (fond ardoise).
 * - `light` : Thème clair haute luminosité.
 * - `amoled` : Noir absolu pour écrans OLED / TV basse consommation.
 * - `auto` : Adaptation automatique selon les préférences de l'OS.
 */
export type Theme = 'dark' | 'light' | 'amoled' | 'auto';

/**
 * Format d'affichage de l'horloge.
 * - `24h` : Format 24 heures (ex. 14:30:00).
 * - `12h` : Format 12 heures avec AM/PM (ex. 02:30:00 PM).
 */
export type TimeFormat = '24h' | '12h';

/**
 * Vitesse de défilement du bandeau d'incidents.
 */
export type MarqueeSpeed = 'slow' | 'normal' | 'fast';

/**
 * Mode de tri des sondes.
 */
export type SortMode = 'smart' | 'alpha' | 'group';

/**
 * Réglages client par défaut transmis par le serveur BFF (issus des variables d'environnement).
 */
export interface ClientDefaultSettings {
  /** Langue active par défaut */
  locale: SupportedLocale;
  /** Thème d'affichage par défaut */
  theme: Theme;
  /** Format de l'horloge par défaut */
  timeFormat: TimeFormat;
  /** Fuseau horaire par défaut ('local', 'UTC', ou identifiant IANA) */
  timeZone: string;
  /** Affichage des secondes par défaut */
  showSeconds: boolean;
  /** Alertes sonores actives par défaut */
  soundEnabled: boolean;
  /** Vitesse de défilement du bandeau d'incidents */
  marqueeSpeed: MarqueeSpeed;
  /** Mode de tri des sondes par défaut */
  sortMode: SortMode;
}

/**
 * Préférences utilisateur stockées côté client dans le LocalStorage.
 */
export interface UserPreferences {
  /** Langue sélectionnée */
  locale?: SupportedLocale;
  /** Thème d'affichage sélectionné */
  theme: Theme;
  /** Mode de tri des sondes ('smart', 'alpha' ou 'group') */
  sortMode: SortMode;
  /** Activation ou coupure des notifications sonores */
  soundEnabled: boolean;
  /** Bascule automatique en plein écran en mode TV (?tv=1) */
  tvAutoFullscreen: boolean;
  /** Format de l'heure (24h ou 12h) */
  timeFormat?: TimeFormat;
  /** Fuseau horaire (ex: 'local', 'UTC', 'Europe/Paris') */
  timeZone?: string;
  /** Affiche ou masque les secondes */
  showSeconds?: boolean;
  /** Vitesse de défilement du bandeau d'incidents */
  marqueeSpeed?: MarqueeSpeed;
}

/**
 * Paramètres d'entrée pour le calcul de géométrie de la grille adaptative.
 */
export interface GridInput {
  /** Largeur disponible du viewport ou conteneur en pixels */
  viewportWidth: number;
  /** Hauteur disponible ou totale de la fenêtre en pixels */
  viewportHeight: number;
  /** Nombre total de sondes actives à disposer */
  probeCount: number;
  /** Hauteur optionnelle de l'en-tête (standard 48px) */
  headerHeight?: number;
  /** Hauteur optionnelle de la barre d'incidents (standard 40px) */
  incidentBarHeight?: number;
  /** Active la contrainte d'accessibilité tactile mobile (cellules min 44px) */
  isMobile?: boolean;
  /** Force le mode zéro-scroll avec pixels collés même sur mobile */
  forceZeroScroll?: boolean;
}

/**
 * Paramètres de disposition calculés dynamiquement pour la grille adaptative.
 */
export interface GridLayout {
  /** Densité retenue pour l'affichage */
  density: GridDensity;
  /** Nombre de colonnes de la grille */
  columns: number;
  /** Nombre de rangées de la grille */
  rows: number;
  /** Dimension d'une cellule carrée en pixels */
  cellSize: number;
  /** Espacement entre cellules en pixels */
  gap: number;
  /** Indique si un défilement vertical est nécessaire (ex. contrainte mobile 44px) */
  overflows?: boolean;
}

