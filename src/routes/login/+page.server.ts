import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	createSession,
	isAuthEnabled,
	isValidSession,
	SESSION_COOKIE_NAME,
	verifyConfiguredPassword
} from '$lib/server/auth';

/**
 * Garde d'accès au chargement de la page /login.
 * Redirige vers la racine si l'authentification n'est pas activée ou
 * si l'utilisateur possède déjà une session active valide.
 */
export const load: PageServerLoad = ({ cookies }) => {
	if (!isAuthEnabled()) {
		throw redirect(303, '/');
	}

	const token = cookies.get(SESSION_COOKIE_NAME);
	if (isValidSession(token)) {
		throw redirect(303, '/');
	}

	return {};
};

/**
 * Action de formulaire SvelteKit traitant la soumission du mot de passe.
 */
export const actions: Actions = {
	default: async ({ request, cookies }) => {
		const formData = await request.formData();
		const password = formData.get('password');

		if (typeof password !== 'string' || !password) {
			return fail(400, { error: true });
		}

		const isValid = verifyConfiguredPassword(password);
		if (!isValid) {
			return fail(400, { error: true });
		}

		// Création du jeton de session aléatoire stocké en mémoire
		const token = createSession();

		// Pose du cookie HTTP-Only sécurisé (SameSite=Strict, maxAge=30j)
		cookies.set(SESSION_COOKIE_NAME, token, {
			path: '/',
			httpOnly: true,
			sameSite: 'strict',
			secure: process.env.NODE_ENV === 'production',
			maxAge: 30 * 24 * 60 * 60 // 30 jours en secondes
		});

		throw redirect(303, '/');
	}
};
