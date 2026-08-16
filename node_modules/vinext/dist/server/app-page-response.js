import { VINEXT_DYNAMIC_STALE_TIME_HEADER, VINEXT_MOUNTED_SLOTS_HEADER, VINEXT_PARAMS_HEADER, VINEXT_PRERENDER_CACHE_LIFE_HEADER, VINEXT_RENDERED_PATH_AND_SEARCH_HEADER, VINEXT_TIMING_HEADER } from "./headers.js";
import { setCacheStateHeaders } from "./cache-headers.js";
import { NO_STORE_CACHE_CONTROL, STATIC_CACHE_CONTROL, buildRevalidateCacheControl } from "./cache-control.js";
import { VINEXT_RSC_CONTENT_TYPE, VINEXT_RSC_VARY_HEADER, applyRscCompatibilityIdHeader, applyRscDeploymentIdHeader } from "./app-rsc-cache-busting.js";
import { mergeMiddlewareResponseHeaders } from "./middleware-response-headers.js";
//#region src/server/app-page-response.ts
function applyTimingHeader(headers, timing) {
	if (!timing) return;
	const handlerStart = Math.round(timing.handlerStart);
	const compileMs = timing.compileEnd !== void 0 ? Math.round(timing.compileEnd - timing.handlerStart) : -1;
	const renderMs = timing.responseKind === "html" && timing.renderEnd !== void 0 && timing.compileEnd !== void 0 ? Math.round(timing.renderEnd - timing.compileEnd) : -1;
	headers.set(VINEXT_TIMING_HEADER, `${handlerStart},${compileMs},${renderMs}`);
}
function applyDynamicStaleTimeHeader(headers, dynamicStaleTimeSeconds) {
	if (dynamicStaleTimeSeconds !== void 0 && Number.isInteger(dynamicStaleTimeSeconds) && dynamicStaleTimeSeconds >= 0) headers.set(VINEXT_DYNAMIC_STALE_TIME_HEADER, String(dynamicStaleTimeSeconds));
}
function applyPrerenderCacheLifeHeader(headers, requestCacheLife) {
	if (!requestCacheLife) return;
	const payload = {};
	if (typeof requestCacheLife.revalidate === "number" && Number.isFinite(requestCacheLife.revalidate)) payload.revalidate = requestCacheLife.revalidate;
	if (typeof requestCacheLife.expire === "number" && Number.isFinite(requestCacheLife.expire)) payload.expire = requestCacheLife.expire;
	if (payload.revalidate === void 0 && payload.expire === void 0) return;
	headers.set(VINEXT_PRERENDER_CACHE_LIFE_HEADER, JSON.stringify(payload));
}
function resolveAppPageRscResponsePolicy(options) {
	if (options.isDraftMode) return { cacheControl: NO_STORE_CACHE_CONTROL };
	if (options.isForceDynamic || options.dynamicUsedDuringBuild) return { cacheControl: NO_STORE_CACHE_CONTROL };
	if (options.revalidateSeconds === 0) return { cacheControl: NO_STORE_CACHE_CONTROL };
	if ((options.isForceStatic || options.isDynamicError) && !options.revalidateSeconds || options.revalidateSeconds === Infinity) return {
		cacheControl: STATIC_CACHE_CONTROL,
		cacheState: "STATIC"
	};
	if (options.revalidateSeconds) return {
		cacheControl: buildRevalidateCacheControl(options.revalidateSeconds, options.expireSeconds),
		cacheState: options.isProduction ? "MISS" : void 0
	};
	return {};
}
function resolveAppPageHtmlResponsePolicy(options) {
	if (options.isDraftMode) return {
		cacheControl: NO_STORE_CACHE_CONTROL,
		shouldWriteToCache: false
	};
	if (options.isForceDynamic) return {
		cacheControl: NO_STORE_CACHE_CONTROL,
		shouldWriteToCache: false
	};
	if (options.hasScriptNonce) return {
		cacheControl: NO_STORE_CACHE_CONTROL,
		shouldWriteToCache: false
	};
	if (options.isProgressiveActionRender) return {
		cacheControl: NO_STORE_CACHE_CONTROL,
		shouldWriteToCache: false
	};
	if (options.revalidateSeconds === 0) return {
		cacheControl: NO_STORE_CACHE_CONTROL,
		shouldWriteToCache: false
	};
	if ((options.isForceStatic || options.isDynamicError) && options.revalidateSeconds === null) return {
		cacheControl: STATIC_CACHE_CONTROL,
		cacheState: options.isProduction ? "MISS" : "STATIC",
		shouldWriteToCache: options.isProduction
	};
	if (options.dynamicUsedDuringRender) return {
		cacheControl: NO_STORE_CACHE_CONTROL,
		shouldWriteToCache: false
	};
	if (options.revalidateSeconds !== null && options.revalidateSeconds > 0 && options.revalidateSeconds !== Infinity) return {
		cacheControl: buildRevalidateCacheControl(options.revalidateSeconds, options.expireSeconds),
		cacheState: options.isProduction ? "MISS" : void 0,
		shouldWriteToCache: options.isProduction
	};
	if (options.revalidateSeconds === Infinity) return {
		cacheControl: STATIC_CACHE_CONTROL,
		cacheState: options.isProduction ? "MISS" : "STATIC",
		shouldWriteToCache: options.isProduction
	};
	return { shouldWriteToCache: false };
}
/**
* Mirror Next.js' edge-runtime marker (set in edge-ssr-app.ts). Only routes
* whose resolved segment config is `runtime = "edge"` should advertise it —
* nodejs-runtime routes must not, otherwise downstream consumers can't tell
* the configured runtime from the response. Centralized so every response
* construction site can opt in without re-deriving the header name.
*/
function applyEdgeRuntimeHeader(headers, isEdgeRuntime) {
	if (isEdgeRuntime) headers.set("x-edge-runtime", "1");
}
function buildAppPageRscResponse(body, options) {
	const headers = new Headers({
		"Content-Type": VINEXT_RSC_CONTENT_TYPE,
		Vary: VINEXT_RSC_VARY_HEADER
	});
	applyEdgeRuntimeHeader(headers, options.isEdgeRuntime);
	if (options.params && Object.keys(options.params).length > 0) headers.set(VINEXT_PARAMS_HEADER, encodeURIComponent(JSON.stringify(options.params)));
	if (options.mountedSlotsHeader) headers.set(VINEXT_MOUNTED_SLOTS_HEADER, options.mountedSlotsHeader);
	applyDynamicStaleTimeHeader(headers, options.dynamicStaleTimeSeconds);
	if (options.policy.cacheControl) headers.set("Cache-Control", options.policy.cacheControl);
	if (options.policy.cacheState) setCacheStateHeaders(headers, options.policy.cacheState);
	mergeMiddlewareResponseHeaders(headers, options.middlewareContext.headers);
	if (options.renderedPathAndSearch) headers.set(VINEXT_RENDERED_PATH_AND_SEARCH_HEADER, encodeURIComponent(options.renderedPathAndSearch));
	applyRscCompatibilityIdHeader(headers);
	applyRscDeploymentIdHeader(headers);
	applyPrerenderCacheLifeHeader(headers, options.requestCacheLife);
	applyTimingHeader(headers, options.timing);
	return new Response(body, {
		status: options.middlewareContext.status ?? 200,
		headers
	});
}
function buildAppPageHtmlResponse(body, options) {
	const headers = new Headers({
		"Content-Type": "text/html; charset=utf-8",
		Vary: VINEXT_RSC_VARY_HEADER
	});
	applyEdgeRuntimeHeader(headers, options.isEdgeRuntime);
	if (options.policy.cacheControl) headers.set("Cache-Control", options.policy.cacheControl);
	if (options.policy.cacheState) setCacheStateHeaders(headers, options.policy.cacheState);
	if (options.draftCookie) headers.append("Set-Cookie", options.draftCookie);
	if (options.linkHeader) headers.set("Link", options.linkHeader);
	mergeMiddlewareResponseHeaders(headers, options.middlewareContext.headers);
	applyPrerenderCacheLifeHeader(headers, options.requestCacheLife);
	applyTimingHeader(headers, options.timing);
	return new Response(body, {
		status: options.middlewareContext.status ?? 200,
		headers
	});
}
//#endregion
export { applyEdgeRuntimeHeader, buildAppPageHtmlResponse, buildAppPageRscResponse, mergeMiddlewareResponseHeaders, resolveAppPageHtmlResponsePolicy, resolveAppPageRscResponsePolicy };
