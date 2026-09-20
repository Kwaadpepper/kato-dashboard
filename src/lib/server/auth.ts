import crypto from 'node:crypto';

/**
 * Standardized session cookie name.
 */
export const SESSION_COOKIE_NAME = 'kato-session';

/** Cryptographic salt length (16 bytes) */
const SALT_LEN = 16;
/** Scrypt derived key length (64 bytes) */
const KEY_LEN = 64;

/**
 * Hashes a plaintext password using crypto.scryptSync.
 * Output format: `<salt_hex>:<hash_hex>`
 *
 * @param password Plaintext password to hash
 * @returns String containing salt and derived hash
 */
export function hashPassword(password: string): string {
	const salt = crypto.randomBytes(SALT_LEN).toString('hex');
	const derivedKey = crypto.scryptSync(password, salt, KEY_LEN);
	return `${salt}:${derivedKey.toString('hex')}`;
}

/**
 * Verifies a submitted password against a stored `<salt_hex>:<hash_hex>` fingerprint
 * in constant time (timingSafeEqual) to prevent timing attacks.
 *
 * @param input Submitted plaintext password
 * @param hash  Stored `<salt_hex>:<hash_hex>` fingerprint
 * @returns true if password matches, false otherwise
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
// SERVER BOOT PASSWORD MANAGEMENT
// ============================================================================

/** In-memory cached hash of KATO_AUTH_PASSWORD */
let configuredPasswordHash: string | null = null;

/**
 * Initializes password hashing configured in environment.
 * Executed once during server initialization.
 */
export function initAuth(): void {
	const rawPassword = process.env.KATO_AUTH_PASSWORD;
	if (rawPassword) {
		configuredPasswordHash = hashPassword(rawPassword);
		console.log('[Auth] Configured password hashed successfully on startup.');
	} else {
		configuredPasswordHash = null;
	}
}

// Immediate initialization upon module load
initAuth();

/**
 * Indicates whether password authentication is enabled on the server.
 */
export function isAuthEnabled(): boolean {
	return process.env.KATO_AUTH_ENABLED === 'true';
}

/**
 * Verifies submitted password against configured master password hash.
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
// IN-MEMORY SESSIONS (RAM)
// ============================================================================

/**
 * In-memory (RAM) registry of active session tokens.
 * Complies with project rule: restart = reset.
 */
const activeSessions = new Set<string>();

/**
 * Generates a new secure random session token (UUID v4) and registers it.
 *
 * @returns Created session token
 */
export function createSession(): string {
	const token = crypto.randomUUID();
	activeSessions.add(token);
	return token;
}

/**
 * Verifies whether a given session token is active.
 *
 * @param token Session token to check
 * @returns true if valid, false otherwise
 */
export function isValidSession(token: string | undefined | null): boolean {
	if (!token) return false;
	return activeSessions.has(token);
}

/**
 * Removes a session from the in-memory registry (logout).
 */
export function invalidateSession(token: string): void {
	activeSessions.delete(token);
}
