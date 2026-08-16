import path from "../deps/.pnpm/pathslash@0.1.0/deps/pathslash/dist/index.js";
import { normalizePathnameForRouteMatchStrict } from "../routing/utils.js";
import { addBasePathToPathname, hasBasePath, removeTrailingSlash, stripBasePath } from "../utils/base-path.js";
import "./server-globals.js";
import { getRequestExecutionContext, runWithExecutionContext } from "../shims/request-context.js";
import "../utils/protocol-headers.js";
import { MIDDLEWARE_REWRITE_HEADER } from "./headers.js";
import { shouldKeepMiddlewareHeader } from "../utils/middleware-request-headers.js";
import { NextFetchEvent, NextRequest } from "../shims/server.js";
import { normalizePath } from "./normalize-path.js";
import { matchesMiddleware } from "./middleware-matcher.js";
import { badRequestResponse, internalServerErrorResponse } from "./http-error-responses.js";
import { processMiddlewareHeaders } from "./request-pipeline.js";
//#region src/server/middleware-runtime.ts
function isMiddlewareHandler(value) {
	return typeof value === "function";
}
function isMiddlewareConfigExport(value) {
	return !!value && typeof value === "object";
}
function middlewareExpectedExport(isProxy) {
	return isProxy ? "proxy" : "middleware";
}
function middlewareDisplayPath(filePath) {
	const fileName = path.basename(filePath);
	return path.basename(path.dirname(filePath)) === "src" ? `./src/${fileName}` : `./${fileName}`;
}
function createMiddlewareMissingExportError(filePath, isProxy) {
	const expectedExport = middlewareExpectedExport(isProxy);
	const displayPath = filePath ? middlewareDisplayPath(filePath) : void 0;
	const resolvedPath = displayPath ? ` "${displayPath}"` : "";
	const migrationReason = isProxy ? "- You are migrating from `middleware` to `proxy`, but haven't updated the exported function.\n" : "";
	return /* @__PURE__ */ new Error(`The file${resolvedPath} must export a function, either as a default export or as a named "${expectedExport}" export.\nThis function is what Next.js runs for every request handled by this ${isProxy ? "proxy (previously called middleware)" : "middleware"}.\n\nWhy this happens:\n` + migrationReason + `- The file exists but doesn't export a function.
- The export is not a function (e.g., an object or constant).
- There's a syntax error preventing the export from being recognized.

To fix it:
- Ensure this file has either a default or "${expectedExport}" function export.\n\nLearn more: https://nextjs.org/docs/messages/middleware-to-proxy`);
}
function resolveMiddlewareModuleHandler(mod, options) {
	const handler = options.isProxy ? mod.proxy ?? mod.default : mod.middleware ?? mod.default;
	if (isMiddlewareHandler(handler)) return handler;
	throw createMiddlewareMissingExportError(options.filePath, options.isProxy);
}
function middlewareMatcher(mod) {
	const config = mod.config;
	if (!isMiddlewareConfigExport(config)) return void 0;
	return config.matcher;
}
function stripMiddlewareHeadersFromResponse(response) {
	const headers = new Headers(response.headers);
	processMiddlewareHeaders(headers);
	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers
	});
}
/**
* Make a same-host URL relative to the request origin. Cross-origin URLs are
* returned unchanged. Mirrors Next.js's `getRelativeURL` behaviour:
* https://github.com/vercel/next.js/blob/canary/packages/next/src/shared/lib/router/utils/relativize-url.ts
*/
function relativizeLocation(location, requestUrl) {
	let parsed;
	try {
		parsed = new URL(location, requestUrl);
	} catch {
		return location;
	}
	const base = new URL(requestUrl);
	if (parsed.origin !== base.origin) return parsed.toString();
	return parsed.pathname + parsed.search + parsed.hash;
}
/**
* Translate a middleware redirect Response into the soft-redirect protocol
* used by Next.js for `_next/data` requests: a 200 OK with the redirect target
* carried in the `x-nextjs-redirect` header. The client router consumes this
* header to perform the navigation, avoiding CORS issues that would arise from
* an actual cross-origin HTTP redirect on a data fetch.
*
* Reference: packages/next/src/server/web/adapter.ts
* https://github.com/vercel/next.js/blob/canary/packages/next/src/server/web/adapter.ts
*/
function dataRedirectResponse(target, originalResponse) {
	const headers = new Headers(originalResponse.headers);
	processMiddlewareHeaders(headers);
	headers.delete("Location");
	headers.set("x-nextjs-redirect", target);
	return new Response(null, {
		status: 200,
		headers
	});
}
function collectMiddlewareHeaders(response) {
	const responseHeaders = new Headers();
	for (const [key, value] of response.headers) if (!key.startsWith("x-middleware-") || shouldKeepMiddlewareHeader(key)) responseHeaders.append(key, value);
	return responseHeaders;
}
function drainFetchEvent(fetchEvent) {
	const waitUntilPromises = fetchEvent.waitUntilPromises;
	const drained = fetchEvent.drainWaitUntil();
	const executionContext = getRequestExecutionContext();
	if (executionContext) executionContext.waitUntil(drained);
	return waitUntilPromises;
}
function resolveMiddlewarePathname(request) {
	const url = new URL(request.url);
	try {
		return normalizePath(normalizePathnameForRouteMatchStrict(url.pathname));
	} catch {
		return badRequestResponse();
	}
}
function createNextRequest(request, i18nConfig, basePath, trailingSlash, hadBasePath) {
	const url = new URL(request.url);
	let mwRequest = request.body && !request.bodyUsed ? request.clone() : request;
	const requestPathname = url.pathname;
	const mwPathname = basePath && hadBasePath && !hasBasePath(requestPathname, basePath) ? addBasePathToPathname(requestPathname, basePath) : requestPathname;
	if (mwPathname !== url.pathname) {
		const mwUrl = new URL(url);
		mwUrl.pathname = mwPathname;
		mwRequest = new Request(mwUrl, mwRequest);
	}
	const nextConfig = basePath || i18nConfig || trailingSlash ? {
		basePath: basePath ?? "",
		i18n: i18nConfig ?? void 0,
		trailingSlash: trailingSlash ?? void 0
	} : void 0;
	return mwRequest instanceof NextRequest ? mwRequest : new NextRequest(mwRequest, nextConfig ? { nextConfig } : void 0);
}
async function executeMiddleware(options) {
	const middlewareFn = resolveMiddlewareModuleHandler(options.module, {
		filePath: options.filePath,
		isProxy: options.isProxy
	});
	const normalizedPathname = options.normalizedPathname ?? resolveMiddlewarePathname(options.request);
	if (normalizedPathname instanceof Response) return {
		continue: false,
		response: normalizedPathname
	};
	const hadBasePath = options.hadBasePath ?? (!options.basePath || hasBasePath(new URL(options.request.url).pathname, options.basePath));
	const matchPathname = options.basePath ? stripBasePath(normalizedPathname, options.basePath) : normalizedPathname;
	if (!matchesMiddleware(matchPathname, middlewareMatcher(options.module), options.request, options.i18nConfig)) return { continue: true };
	const nextRequest = createNextRequest(options.request, options.i18nConfig, options.basePath, options.trailingSlash, hadBasePath);
	if (options.isDataRequest) Object.defineProperty(nextRequest, "__isData", {
		enumerable: false,
		value: true
	});
	const fetchEvent = new NextFetchEvent({ page: removeTrailingSlash(matchPathname) });
	let response;
	try {
		response = await middlewareFn(nextRequest, fetchEvent);
	} catch (e) {
		console.error("[vinext] Middleware error:", e);
		const waitUntilPromises = drainFetchEvent(fetchEvent);
		return {
			continue: false,
			response: internalServerErrorResponse(options.includeErrorDetails ? "Middleware Error: " + (e instanceof Error ? e.message : String(e)) : "Internal Server Error"),
			waitUntilPromises
		};
	} finally {
		if (process.env.NODE_ENV !== "development" && nextRequest.body) nextRequest.body.cancel().catch(() => {});
	}
	const waitUntilPromises = drainFetchEvent(fetchEvent);
	if (!response) return {
		continue: true,
		waitUntilPromises
	};
	if (response.headers.get("x-middleware-next") === "1") return {
		continue: true,
		responseHeaders: collectMiddlewareHeaders(response),
		status: response.status !== 200 ? response.status : void 0,
		waitUntilPromises
	};
	if (response.status >= 300 && response.status < 400) {
		const location = response.headers.get("Location") ?? response.headers.get("location");
		if (location) {
			const relativeLocation = relativizeLocation(location, options.request.url);
			let normalizedLocation = relativeLocation;
			if (options.trailingSlash !== void 0) try {
				const loc = new URL(relativeLocation, options.request.url);
				if (loc.origin === new URL(options.request.url).origin) {
					const p = loc.pathname;
					let normalized = null;
					if (p !== "" && p !== "/") if (options.trailingSlash) normalized = p.endsWith("/") ? null : p + "/";
					else normalized = p.endsWith("/") ? p.slice(0, -1) : null;
					if (normalized !== null) normalizedLocation = normalized + loc.search + loc.hash;
				}
			} catch {}
			if (options.isDataRequest) return {
				continue: false,
				response: dataRedirectResponse(normalizedLocation, response),
				waitUntilPromises
			};
			const responseHeaders = new Headers();
			for (const [key, value] of response.headers) if (!key.startsWith("x-middleware-") && key.toLowerCase() !== "location") responseHeaders.append(key, value);
			const relativizedResponseHeaders = new Headers(response.headers);
			relativizedResponseHeaders.set("Location", normalizedLocation);
			const relativizedResponse = new Response(response.body, {
				status: response.status,
				statusText: response.statusText,
				headers: relativizedResponseHeaders
			});
			return {
				continue: false,
				redirectUrl: normalizedLocation,
				redirectStatus: response.status,
				response: stripMiddlewareHeadersFromResponse(relativizedResponse),
				responseHeaders,
				waitUntilPromises
			};
		}
	}
	const rewriteUrl = response.headers.get(MIDDLEWARE_REWRITE_HEADER);
	if (rewriteUrl) {
		let rewritePath;
		try {
			const rewriteParsed = new URL(rewriteUrl, options.request.url);
			const requestOrigin = new URL(options.request.url).origin;
			if (rewriteParsed.origin === requestOrigin) rewritePath = (options.basePath ? stripBasePath(rewriteParsed.pathname, options.basePath) : rewriteParsed.pathname) + rewriteParsed.search;
			else rewritePath = rewriteParsed.href;
		} catch {
			rewritePath = rewriteUrl;
		}
		return {
			continue: true,
			rewriteUrl: rewritePath,
			rewriteStatus: response.status !== 200 ? response.status : void 0,
			responseHeaders: collectMiddlewareHeaders(response),
			status: response.status !== 200 ? response.status : void 0,
			waitUntilPromises
		};
	}
	return {
		continue: false,
		response: stripMiddlewareHeadersFromResponse(response),
		waitUntilPromises
	};
}
async function runGeneratedMiddleware(options) {
	const run = () => executeMiddleware(options);
	return options.ctx ? runWithExecutionContext(options.ctx, run) : run();
}
//#endregion
export { createMiddlewareMissingExportError, executeMiddleware, resolveMiddlewareModuleHandler, runGeneratedMiddleware };
