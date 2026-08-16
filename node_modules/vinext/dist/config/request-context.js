import { parseCookieHeader } from "../utils/parse-cookie.js";
//#region src/config/request-context.ts
function parseCookies(cookieHeader) {
	return parseCookieHeader(cookieHeader);
}
function normalizeHost(hostHeader, fallbackHostname) {
	return (hostHeader ?? fallbackHostname).split(":", 1)[0].toLowerCase();
}
/** Build a lazily parsed request context from a Web Request. */
function requestContextFromRequest(request) {
	const url = new URL(request.url);
	let cookies;
	let query;
	return {
		headers: request.headers,
		get cookies() {
			return cookies ??= parseCookies(request.headers.get("cookie"));
		},
		get query() {
			return query ??= url.searchParams;
		},
		host: normalizeHost(request.headers.get("host"), url.hostname)
	};
}
//#endregion
export { normalizeHost, parseCookies, requestContextFromRequest };
