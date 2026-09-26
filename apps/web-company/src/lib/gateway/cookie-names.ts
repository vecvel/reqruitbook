/**
 * The session cookie names, in a module with no imports.
 *
 * They live here rather than in `tokens.ts` because the middleware needs them
 * too, and `tokens.ts` reaches for `next/headers` — which does not exist in the
 * middleware runtime. Importing it there to read a string constant would break
 * the request pipeline for the whole app.
 *
 * Keeping them in one place is not tidiness. The middleware decides whether a
 * request has a session by looking for one of these; when it looked for a name
 * nothing wrote any more, every signed-in user was redirected back to the login
 * screen they had just completed, and the sign-in itself looked like it worked.
 */

/** Short-lived access token; expires with the JWT it holds. */
export const ACCESS_COOKIE = "rb_access";

/** Long-lived rotating refresh token. Its presence is what "signed in" means. */
export const REFRESH_COOKIE = "rb_refresh";

/** Display-only identity the access token does not carry. Nothing is authorized from it. */
export const PROFILE_COOKIE = "rb_profile";
