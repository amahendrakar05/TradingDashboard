import { addBasePathToPathname } from "../utils/base-path.js";
import { buildRequestHeadersFromMiddlewareResponse } from "../utils/middleware-request-headers.js";
import { NextRequest, RequestCookies, sealRequestCookies, sealRequestHeaders } from "../shims/server.js";
//#region src/server/app-route-handler-runtime.ts
const ROUTE_HANDLER_HTTP_METHODS = [
	"GET",
	"HEAD",
	"POST",
	"PUT",
	"DELETE",
	"PATCH",
	"OPTIONS"
];
/**
* Checks whether a string is a recognized HTTP method for App Router route
* handlers. Invalid methods must be rejected with 400 before any auto-OPTIONS
* or 405 logic runs.
*
* @see https://github.com/vercel/next.js/blob/canary/packages/next/src/server/web/http.ts
*/
function isValidHTTPMethod(maybeMethod) {
	return ROUTE_HANDLER_HTTP_METHODS.includes(maybeMethod);
}
function collectRouteHandlerMethods(handler) {
	const methods = ROUTE_HANDLER_HTTP_METHODS.filter((method) => typeof handler[method] === "function");
	if (methods.includes("GET") && !methods.includes("HEAD")) methods.push("HEAD");
	return methods;
}
function buildRouteHandlerAllowHeader(exportedMethods) {
	const allow = new Set(exportedMethods);
	allow.add("OPTIONS");
	return Array.from(allow).sort().join(", ");
}
const _KNOWN_DYNAMIC_APP_ROUTE_HANDLERS_KEY = Symbol.for("vinext.appRouteHandlerRuntime.knownDynamicHandlers");
const _g = globalThis;
const knownDynamicAppRouteHandlers = _g[_KNOWN_DYNAMIC_APP_ROUTE_HANDLERS_KEY] ??= /* @__PURE__ */ new Set();
function isKnownDynamicAppRoute(pattern) {
	return knownDynamicAppRouteHandlers.has(pattern);
}
function markKnownDynamicAppRoute(pattern) {
	knownDynamicAppRouteHandlers.add(pattern);
}
function bindMethodIfNeeded(value, target) {
	return typeof value === "function" ? value.bind(target) : value;
}
function buildNextConfig(options) {
	if (!options.basePath && !options.i18n && !options.trailingSlash) return null;
	return {
		basePath: options.basePath,
		i18n: options.i18n ?? void 0,
		trailingSlash: options.trailingSlash
	};
}
function rebuildRequestWithHeaders(input, headers) {
	const method = input.method;
	const hasBody = method !== "GET" && method !== "HEAD";
	const init = {
		method,
		headers,
		cache: input.cache,
		credentials: input.credentials,
		integrity: input.integrity,
		keepalive: input.keepalive,
		mode: input.mode,
		redirect: input.redirect,
		referrer: input.referrer,
		referrerPolicy: input.referrerPolicy,
		signal: input.signal
	};
	if (hasBody && input.body) {
		init.body = input.body;
		init.duplex = "half";
	}
	return new Request(input.url, init);
}
function cleanStaticUrl(url) {
	const cleanUrl = new URL(url);
	cleanUrl.protocol = "http:";
	cleanUrl.host = "localhost:3000";
	cleanUrl.username = "";
	cleanUrl.password = "";
	cleanUrl.search = "";
	cleanUrl.hash = "";
	return cleanUrl.href;
}
function readEmptyBodyAsArrayBuffer() {
	return new Response(null).arrayBuffer();
}
function readEmptyBodyAsBlob() {
	return new Response(null).blob();
}
function readEmptyBodyAsFormData() {
	return new Response(null).formData();
}
function readEmptyBodyAsJson() {
	return new Response(null).json();
}
function readEmptyBodyAsText() {
	return new Response(null).text();
}
function createTrackedAppRouteRequest(request, options = {}) {
	let didAccessDynamicRequest = false;
	const requestMode = options.requestMode ?? "auto";
	const nextConfig = buildNextConfig(options);
	const markDynamicAccess = (access) => {
		didAccessDynamicRequest = true;
		options.onDynamicAccess?.(access);
	};
	const wrapNextUrl = (nextUrl) => {
		return new Proxy(nextUrl, { get(target, prop) {
			switch (prop) {
				case "search":
				case "searchParams":
				case "url":
				case "href":
				case "toJSON":
				case "toString":
				case "origin":
					markDynamicAccess(`nextUrl.${String(prop)}`);
					return bindMethodIfNeeded(Reflect.get(target, prop, target), target);
				case "clone": return () => wrapNextUrl(target.clone());
				default: return bindMethodIfNeeded(Reflect.get(target, prop, target), target);
			}
		} });
	};
	const wrapForceStaticNextUrl = (nextUrl) => {
		const emptySearchParams = new URLSearchParams();
		const staticHref = cleanStaticUrl(nextUrl.href);
		return new Proxy(nextUrl, { get(target, prop) {
			switch (prop) {
				case "search": return "";
				case "searchParams": return emptySearchParams;
				case "href": return staticHref;
				case "url": return;
				case "toJSON":
				case "toString": return () => staticHref;
				case "clone": return () => wrapForceStaticNextUrl(target.clone());
				default: return bindMethodIfNeeded(Reflect.get(target, prop, target), target);
			}
		} });
	};
	const throwStaticGenerationError = (expression) => {
		throw new Error(options.staticGenerationErrorMessage?.(expression) ?? `Route handler with \`dynamic = "error"\` used ${expression}.`);
	};
	const wrapRequireStaticNextUrl = (nextUrl) => {
		return new Proxy(nextUrl, { get(target, prop) {
			switch (prop) {
				case "search":
				case "searchParams":
				case "url":
				case "href":
				case "toJSON":
				case "toString":
				case "origin": return throwStaticGenerationError(`nextUrl.${String(prop)}`);
				case "clone": return () => wrapRequireStaticNextUrl(target.clone());
				default: return bindMethodIfNeeded(Reflect.get(target, prop, target), target);
			}
		} });
	};
	const wrapRequest = (rawInput) => {
		let input = rawInput;
		if (options.basePath) {
			const inputUrl = new URL(rawInput.url);
			const prefixedPathname = addBasePathToPathname(inputUrl.pathname, options.basePath);
			if (prefixedPathname !== inputUrl.pathname) {
				inputUrl.pathname = prefixedPathname;
				const bodySource = rawInput.body && !rawInput.bodyUsed ? rawInput.clone() : rawInput;
				input = new Request(inputUrl, bodySource);
			}
		}
		const requestHeaders = options.middlewareHeaders ? buildRequestHeadersFromMiddlewareResponse(input.headers, options.middlewareHeaders) : null;
		const requestWithOverrides = requestHeaders ? rebuildRequestWithHeaders(input, requestHeaders) : input;
		const nextRequest = requestWithOverrides instanceof NextRequest ? requestWithOverrides : new NextRequest(requestWithOverrides, { nextConfig: nextConfig ?? void 0 });
		let proxiedNextUrl = null;
		let forceStaticNextUrl = null;
		let requireStaticNextUrl = null;
		let forceStaticHeaders = null;
		let forceStaticCookies = null;
		return new Proxy(nextRequest, { get(target, prop) {
			if (requestMode === "force-static") switch (prop) {
				case "nextUrl":
					forceStaticNextUrl ??= wrapForceStaticNextUrl(target.nextUrl);
					return forceStaticNextUrl;
				case "headers":
					forceStaticHeaders ??= sealRequestHeaders(new Headers());
					return forceStaticHeaders;
				case "cookies":
					forceStaticCookies ??= sealRequestCookies(new RequestCookies(new Headers()));
					return forceStaticCookies;
				case "url": return cleanStaticUrl(target.nextUrl.href);
				case "ip":
				case "geo": return;
				case "body": return null;
				case "arrayBuffer": return readEmptyBodyAsArrayBuffer;
				case "blob": return readEmptyBodyAsBlob;
				case "formData": return readEmptyBodyAsFormData;
				case "json": return readEmptyBodyAsJson;
				case "text": return readEmptyBodyAsText;
				case "clone": return () => wrapRequest(target.clone());
				default: return bindMethodIfNeeded(Reflect.get(target, prop, target), target);
			}
			if (requestMode === "error") switch (prop) {
				case "nextUrl":
					requireStaticNextUrl ??= wrapRequireStaticNextUrl(target.nextUrl);
					return requireStaticNextUrl;
				case "headers":
				case "cookies":
				case "url":
				case "ip":
				case "geo":
				case "body":
				case "blob":
				case "json":
				case "text":
				case "arrayBuffer":
				case "formData": return throwStaticGenerationError(`request.${String(prop)}`);
				case "clone": return () => wrapRequest(target.clone());
				default: return bindMethodIfNeeded(Reflect.get(target, prop, target), target);
			}
			switch (prop) {
				case "nextUrl":
					proxiedNextUrl ??= wrapNextUrl(target.nextUrl);
					return proxiedNextUrl;
				case "headers":
				case "cookies":
				case "ip":
				case "geo":
				case "url":
				case "body":
				case "blob":
				case "json":
				case "text":
				case "arrayBuffer":
				case "formData":
					markDynamicAccess(`request.${String(prop)}`);
					return bindMethodIfNeeded(Reflect.get(target, prop, target), target);
				case "clone": return () => wrapRequest(target.clone());
				default: return bindMethodIfNeeded(Reflect.get(target, prop, target), target);
			}
		} });
	};
	return {
		request: wrapRequest(request),
		didAccessDynamicRequest() {
			return didAccessDynamicRequest;
		}
	};
}
//#endregion
export { buildRouteHandlerAllowHeader, collectRouteHandlerMethods, createTrackedAppRouteRequest, isKnownDynamicAppRoute, isValidHTTPMethod, markKnownDynamicAppRoute };
