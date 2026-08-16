//#region src/shims/internal/cookie-serialize.ts
/**
* RFC 6265 §4.1.1: cookie-name is a token (RFC 2616 §2.2).
* Allowed: any visible ASCII (0x21-0x7E) except separators: ()<>@,;:\"/[]?={}
*/
const VALID_COOKIE_NAME_RE = /^[\x21\x23-\x27\x2A\x2B\x2D\x2E\x30-\x39\x41-\x5A\x5E-\x7A\x7C\x7E]+$/;
function validateCookieName(name) {
	if (!name || !VALID_COOKIE_NAME_RE.test(name)) throw new Error(`Invalid cookie name: ${JSON.stringify(name)}`);
}
/**
* Validate cookie attribute values (path, domain) to prevent injection
* via semicolons, newlines, or other control characters.
*/
function validateCookieAttributeValue(value, attributeName) {
	for (let i = 0; i < value.length; i++) {
		const code = value.charCodeAt(i);
		if (code <= 31 || code === 127 || value[i] === ";") throw new Error(`Invalid cookie ${attributeName} value: ${JSON.stringify(value)}`);
	}
}
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
function serializeSetCookie(name, value, options) {
	const parts = [`${name}=${encodeURIComponent(value)}`];
	const path = options?.path ?? "/";
	validateCookieAttributeValue(path, "Path");
	parts.push(`Path=${path}`);
	if (options?.domain) {
		validateCookieAttributeValue(options.domain, "Domain");
		parts.push(`Domain=${options.domain}`);
	}
	if (options?.maxAge !== void 0) parts.push(`Max-Age=${options.maxAge}`);
	if (options?.expires) parts.push(`Expires=${options.expires.toUTCString()}`);
	if (options?.httpOnly) parts.push("HttpOnly");
	if (options?.secure) parts.push("Secure");
	if (options?.sameSite) parts.push(`SameSite=${options.sameSite}`);
	if (options?.partitioned) parts.push("Partitioned");
	if (options?.priority) parts.push(`Priority=${options.priority[0].toUpperCase()}${options.priority.slice(1)}`);
	return parts.join("; ");
}
//#endregion
export { serializeSetCookie, validateCookieAttributeValue, validateCookieName };
