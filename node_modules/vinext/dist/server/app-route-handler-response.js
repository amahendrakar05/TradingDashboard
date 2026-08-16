import "../utils/protocol-headers.js";
import "./headers.js";
import { processMiddlewareHeaders } from "./request-pipeline.js";
import { setCacheStateHeaders } from "./cache-headers.js";
import { applyCdnResponseHeaders } from "./cache-control.js";
import { buildAppRouteMissIsrCacheControl, decideIsr } from "./isr-decision.js";
import { mergeMiddlewareResponseHeaders } from "./middleware-response-headers.js";
import { getSetCookieName } from "./cookie-utils.js";
//#region src/server/app-route-handler-response.ts
const APP_ROUTE_REWRITE_ERROR = "NextResponse.rewrite() was used in a app route handler, this is not currently supported. Please remove the invocation to continue.";
const APP_ROUTE_NEXT_ERROR = "NextResponse.next() was used in a app route handler, this is not supported. See here for more info: https://nextjs.org/docs/messages/next-response-next-in-app-route-handler";
function hasMiddlewareHeader(headers) {
	for (const key of headers.keys()) if (key.startsWith("x-middleware-")) return true;
	return false;
}
function applyRouteHandlerMiddlewareContext(response, middlewareContext) {
	if (!middlewareContext.headers && middlewareContext.status == null) return response;
	const responseHeaders = new Headers(response.headers);
	mergeMiddlewareResponseHeaders(responseHeaders, middlewareContext.headers);
	return new Response(response.body, {
		status: middlewareContext.status ?? response.status,
		statusText: response.statusText,
		headers: responseHeaders
	});
}
function assertSupportedAppRouteHandlerResponse(response) {
	if (response.headers.has("x-middleware-rewrite")) throw new Error(APP_ROUTE_REWRITE_ERROR);
	if (response.headers.get("x-middleware-next") === "1") throw new Error(APP_ROUTE_NEXT_ERROR);
}
function buildRouteHandlerCachedResponse(cachedValue, options) {
	const headers = new Headers();
	for (const [key, value] of Object.entries(cachedValue.headers)) if (Array.isArray(value)) for (const entry of value) headers.append(key, entry);
	else headers.set(key, value);
	setCacheStateHeaders(headers, options.cacheState);
	const { cacheControl } = decideIsr({
		cacheState: options.cacheState,
		kind: "app-route",
		revalidateSeconds: options.revalidateSeconds,
		expireSeconds: options.expireSeconds,
		cacheControlMeta: options.cacheControl
	});
	applyCdnResponseHeaders(headers, { cacheControl });
	return new Response(options.isHead ? null : cachedValue.body, {
		status: cachedValue.status,
		headers
	});
}
function applyRouteHandlerRevalidateHeader(response, revalidateSeconds, expireSeconds, tags) {
	applyCdnResponseHeaders(response.headers, {
		cacheControl: buildAppRouteMissIsrCacheControl(revalidateSeconds, expireSeconds),
		tags
	});
}
function markRouteHandlerCacheMiss(response) {
	setCacheStateHeaders(response.headers, "MISS");
}
/**
* Returns true when the given Set-Cookie string already declares any of the
* attributes that follow the first `;` (case-insensitively). Used to detect
* whether a user-emitted Set-Cookie line already carries an explicit `Path=`,
* matching Next.js's `appendMutableCookies` which re-runs every cookie through
* `ResponseCookies.set` (and therefore picks up the `Path=/` default for any
* cookie that didn't supply one).
*/
function hasCookieAttribute(cookie, attributeName) {
	const target = attributeName.toLowerCase();
	let i = cookie.indexOf(";");
	while (i !== -1) {
		let start = i + 1;
		while (start < cookie.length && cookie[start] === " ") start++;
		const next = cookie.indexOf(";", start);
		const end = next === -1 ? cookie.length : next;
		const eq = cookie.indexOf("=", start);
		const attrEnd = eq === -1 || eq > end ? end : eq;
		if (cookie.slice(start, attrEnd).trim().toLowerCase() === target) return true;
		i = next;
	}
	return false;
}
/**
* Ensure each Set-Cookie line carries `Path=/` by default — Next.js's
* `appendMutableCookies` re-runs every returned cookie through
* `ResponseCookies.set`, which normalises a missing `path` to `/`. Without
* this, a raw `new Response(..., { headers: [['Set-Cookie', 'bar=bar2']] })`
* lands without `Path=/` and tests that assert on the full attribute set
* (e.g. Next.js's `app-action.test.ts` route-handler-overrides case, see
* issue #1484) break.
*/
function normalizeReturnedCookie(cookie) {
	if (hasCookieAttribute(cookie, "Path")) return cookie;
	return `${cookie.replace(/;\s*$/, "")}; Path=/`;
}
function applyMutableCookieFallbacks(headers, pendingCookies) {
	if (pendingCookies.length === 0) return;
	const returnedCookies = headers.getSetCookie();
	const returnedCookieNames = /* @__PURE__ */ new Set();
	for (const cookie of returnedCookies) {
		const name = getSetCookieName(cookie);
		if (name) returnedCookieNames.add(name);
	}
	const fallbackCookies = /* @__PURE__ */ new Map();
	const unkeyedFallbackCookies = [];
	for (const cookie of pendingCookies) {
		const name = getSetCookieName(cookie);
		if (!name) {
			unkeyedFallbackCookies.push(cookie);
			continue;
		}
		if (!returnedCookieNames.has(name)) fallbackCookies.set(name, cookie);
	}
	headers.delete("Set-Cookie");
	for (const cookie of unkeyedFallbackCookies) headers.append("Set-Cookie", cookie);
	for (const cookie of fallbackCookies.values()) headers.append("Set-Cookie", cookie);
	for (const cookie of returnedCookies) headers.append("Set-Cookie", normalizeReturnedCookie(cookie));
}
async function buildAppRouteCacheValue(response) {
	const body = await response.arrayBuffer();
	const headers = {};
	response.headers.forEach((value, key) => {
		if (key === "set-cookie" || key === "X-Vinext-Cache".toLowerCase() || key === "x-nextjs-cache".toLowerCase() || key === "cache-control" || key.startsWith("x-middleware-")) return;
		headers[key] = value;
	});
	const setCookies = response.headers.getSetCookie?.() ?? [];
	if (setCookies.length > 0) headers["set-cookie"] = setCookies;
	return {
		kind: "APP_ROUTE",
		body,
		status: response.status,
		headers
	};
}
function finalizeRouteHandlerResponse(response, options) {
	const { pendingCookies, draftCookie, isHead } = options;
	if (pendingCookies.length === 0 && !draftCookie && !isHead && !hasMiddlewareHeader(response.headers)) return response;
	const headers = new Headers(response.headers);
	processMiddlewareHeaders(headers);
	applyMutableCookieFallbacks(headers, pendingCookies);
	if (draftCookie) headers.append("Set-Cookie", draftCookie);
	return new Response(isHead ? null : response.body, {
		status: response.status,
		statusText: response.statusText,
		headers
	});
}
//#endregion
export { applyRouteHandlerMiddlewareContext, applyRouteHandlerRevalidateHeader, assertSupportedAppRouteHandlerResponse, buildAppRouteCacheValue, buildRouteHandlerCachedResponse, finalizeRouteHandlerResponse, markRouteHandlerCacheMiss };
