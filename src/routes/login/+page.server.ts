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
 * Access guard for /login page load.
 * Redirects to dashboard root if auth is not enabled or if
 * the user already holds a valid active session.
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
 * SvelteKit form action processing password login submission.
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

		// Create random session token in memory
		const token = createSession();

		// Set secure HTTP-Only session cookie (SameSite=Strict, maxAge=30d)
		cookies.set(SESSION_COOKIE_NAME, token, {
			path: '/',
			httpOnly: true,
			sameSite: 'strict',
			secure: process.env.NODE_ENV === 'production',
			maxAge: 30 * 24 * 60 * 60 // 30 days in seconds
		});

		throw redirect(303, '/');
	}
};
