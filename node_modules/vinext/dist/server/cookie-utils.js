//#region src/server/cookie-utils.ts
/**
* Parse the cookie name out of a serialised Set-Cookie line.
*
* Bounded by the first `;` so the attribute portion (e.g. `Path=/`) is never
* mistaken for part of the name when the value happens to contain another
* `=`. Returns null when the line is not parseable (defensive — callers keep
* unparseable entries verbatim so they don't drop user-supplied cookies).
*/
function getSetCookieName(cookie) {
	const equalsIndex = cookie.indexOf("=");
	if (equalsIndex <= 0) return null;
	const semicolonIndex = cookie.indexOf(";");
	const end = semicolonIndex === -1 ? equalsIndex : Math.min(equalsIndex, semicolonIndex);
	return cookie.slice(0, end);
}
//#endregion
export { getSetCookieName };
