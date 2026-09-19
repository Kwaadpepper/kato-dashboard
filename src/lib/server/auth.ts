import crypto from 'node:crypto';

/**
 * Nom standardisé du cookie de session d'authentification.
 */
export const SESSION_COOKIE_NAME = 'kato-session';

/** Longueur du sel cryptographique (16 octets) */
const SALT_LEN = 16;
/** Longueur de la clé dérivée scrypt (64 octets) */
const KEY_LEN = 64;

/**
 * Hache un mot de passe en utilisant l'algorithme natif et sécurisé crypto.scryptSync.
 * Format de sortie : `<sel_hex>:<hash_hex>`
 *
 * @param password Mot de passe en clair à hacher
 * @returns Chaîne contenant le sel et l'empreinte hachée
 */
export function hashPassword(password: string): string {
	const salt = crypto.randomBytes(SALT_LEN).toString('hex');
	const derivedKey = crypto.scryptSync(password, salt, KEY_LEN);
	return `${salt}:${derivedKey.toString('hex')}`;
}

/**
 * Vérifie un mot de passe soumis contre une empreinte hachée existante
 * en temps constant (timingSafeEqual) pour prévenir les attaques temporelles.
 *
 * @param input Mot de passe en clair soumis
 * @param hash  Empreinte `<sel_hex>:<hash_hex>` stockée
 * @returns true si le mot de passe correspond, false sinon
 */
export function verifyPassword(input: string, hash: string): boolean {
	try {
		const [salt, originalHash] = hash.split(':');
		if (!salt || !originalHash) return false;

		const derivedKey = crypto.scryptSync(input, salt, KEY_LEN);
		const originalBuffer = Buffer.from(originalHash, 'hex');

		if (derivedKey.length !== originalBuffer.length) {
			return false;
		}

		return crypto.timingSafeEqual(derivedKey, originalBuffer);
	} catch {
		return false;
	}
}

// ============================================================================
// GESTION DU MOT DE PASSE CONFIGURÉ AU BOOT DU SERVEUR
// ============================================================================

/** Empreinte hachée unique du mot de passe maître KATO_AUTH_PASSWORD */
let configuredPasswordHash: string | null = null;

/**
 * Initialise le hachage du mot de passe configuré dans l'environnement.
 * Exécuté une seule fois au démarrage du serveur.
 */
export function initAuth(): void {
	const rawPassword = process.env.KATO_AUTH_PASSWORD;
	if (rawPassword) {
		configuredPasswordHash = hashPassword(rawPassword);
		console.log('[Auth] Mot de passe configuré haché avec succès au démarrage.');
	} else {
		configuredPasswordHash = null;
	}
}

// Initialisation immédiate au chargement du module
initAuth();

/**
 * Indique si l'authentification par mot de passe est requise sur le serveur.
 */
export function isAuthEnabled(): boolean {
	return process.env.KATO_AUTH_ENABLED === 'true';
}

/**
 * Vérifie le mot de passe soumis contre le mot de passe maître hashé en mémoire.
 */
export function verifyConfiguredPassword(input: string): boolean {
	if (!configuredPasswordHash) {
		const envPass = process.env.KATO_AUTH_PASSWORD;
		if (!envPass) return false;
		configuredPasswordHash = hashPassword(envPass);
	}
	return verifyPassword(input, configuredPasswordHash);
}

// ============================================================================
// GESTION DES SESSIONS IN-MEMORY (RAM)
// ============================================================================

/**
 * Registre in-memory (RAM) des jetons de session actifs.
 * Conforme aux règles projet : restart = reset.
 */
const activeSessions = new Set<string>();

/**
 * Génère un nouveau token aléatoire sécurisé (UUID v4) et l'enregistre dans les sessions actives.
 *
 * @returns Le jeton de session créé
 */
export function createSession(): string {
	const token = crypto.randomUUID();
	activeSessions.add(token);
	return token;
}

/**
 * Vérifie si un jeton de session fourni est présent dans le Set des sessions actives.
 *
 * @param token Jeton de session à valider
 * @returns true si la session est valide, false sinon
 */
export function isValidSession(token: string | undefined | null): boolean {
	if (!token) return false;
	return activeSessions.has(token);
}

/**
 * Supprime une session du registre en mémoire (déconnexion).
 */
export function invalidateSession(token: string): void {
	activeSessions.delete(token);
}
