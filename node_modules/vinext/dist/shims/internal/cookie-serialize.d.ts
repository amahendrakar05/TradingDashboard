//#region src/shims/internal/cookie-serialize.d.ts
/**
 * Shared Set-Cookie serialization for the next/headers and next/server shims.
 *
 * Two call sites — `cookies().set()` in headers.ts and `ResponseCookies.set()`
 * in server.ts — produce identical Set-Cookie header strings. Keep the
 * encoding, attribute order, and validation in one place so subtle RFC 6265
 * details (escaping, attribute ordering, etc.) cannot drift between them.
 *
 * Note: this is a value-encoding helper for response cookies only. The
 * request `Cookie:` header serialization in `RequestCookies._serialize`
 * (server.ts) intentionally lives separately — it builds a different format
 * (no attributes, just `name=value; name=value`) and shouldn't share this
 * code.
 */
type SerializeSetCookieOptions = {
  path?: string;
  domain?: string;
  maxAge?: number;
  expires?: Date;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "Strict" | "Lax" | "None";
  partitioned?: boolean;
  priority?: "low" | "medium" | "high";
};
declare function validateCookieName(name: string): void;
/**
 * Validate cookie attribute values (path, domain) to prevent injection
 * via semicolons, newlines, or other control characters.
 */
declare function validateCookieAttributeValue(value: string, attributeName: string): void;
/**
 * Build a Set-Cookie header string from a cookie name, value, and attributes.
 *
 * - Encodes the value with `encodeURIComponent`.
 * - Defaults `Path` to `/` (matching @edge-runtime/cookies and Next.js).
 * - Validates path/domain to reject control characters and semicolons.
 * - Emits attributes in the order: Path, Domain, Max-Age, Expires, HttpOnly,
 *   Secure, SameSite, Partitioned, Priority.
 *
 * The caller is responsible for validating the cookie name (typically before
 * mutating any internal state) via `validateCookieName`.
 */
declare function serializeSetCookie(name: string, value: string, options?: SerializeSetCookieOptions): string;
//#endregion
export { serializeSetCookie, validateCookieAttributeValue, validateCookieName };