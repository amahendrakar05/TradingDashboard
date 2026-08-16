//#region src/server/cookie-utils.d.ts
/**
 * Parse the cookie name out of a serialised Set-Cookie line.
 *
 * Bounded by the first `;` so the attribute portion (e.g. `Path=/`) is never
 * mistaken for part of the name when the value happens to contain another
 * `=`. Returns null when the line is not parseable (defensive — callers keep
 * unparseable entries verbatim so they don't drop user-supplied cookies).
 */
declare function getSetCookieName(cookie: string): string | null;
//#endregion
export { getSetCookieName };