import { VINEXT_MOUNTED_SLOTS_HEADER } from "./headers.js";
import { setCacheStateHeaders } from "./cache-headers.js";
import { applyCdnResponseHeaders } from "./cache-control.js";
import { decideIsr } from "./isr-decision.js";
import { buildAppPageCacheValue } from "./isr-cache.js";
import { encodeCacheTag } from "../utils/encode-cache-tag.js";
import { VINEXT_RSC_CONTENT_TYPE, VINEXT_RSC_VARY_HEADER, applyRscCompatibilityIdHeader, applyRscDeploymentIdHeader } from "./app-rsc-cache-busting.js";
import { mergeMiddlewareResponseHeaders } from "./middleware-response-headers.js";
import { applyEdgeRuntimeHeader } from "./app-page-response.js";
import { hasCompleteNegativeRequestApiProof } from "./cache-proof.js";
import { isAppPprDynamicFallbackShellHtml } from "./app-ppr-fallback-shell.js";
import { finalizeAppPageHtmlCacheResponse, finalizeAppPageRscCacheResponse, scheduleAppPageRscCacheWrite } from "./app-page-cache-finalizer.js";
//#region src/server/app-page-cache.ts
function recordAppPageCacheOutcome(recordCacheOutcome, input) {
	try {
		recordCacheOutcome?.(input);
	} catch {}
}
function buildAppPageCacheTags(pathname, extraTags) {
	const tags = [
		pathname,
		`_N_T_${pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname}`,
		"_N_T_/layout"
	];
	const segments = pathname.split("/");
	let built = "";
	for (let index = 1; index < segments.length; index++) {
		const segment = segments[index];
		if (segment) {
			built += `/${segment}`;
			tags.push(`_N_T_${built}/layout`);
		}
	}
	tags.push(`_N_T_${built}/page`);
	for (const tag of extraTags) if (!tags.includes(tag)) tags.push(tag);
	return tags.map(encodeCacheTag);
}
function buildAppPageCachedHeaders(options) {
	const headers = new Headers({
		"Content-Type": options.contentType,
		Vary: VINEXT_RSC_VARY_HEADER
	});
	applyCdnResponseHeaders(headers, { cacheControl: options.cacheControl });
	setCacheStateHeaders(headers, options.cacheState);
	applyEdgeRuntimeHeader(headers, options.isEdgeRuntime);
	if (options.linkHeader) if (Array.isArray(options.linkHeader)) for (const value of options.linkHeader) headers.append("Link", value);
	else headers.set("Link", options.linkHeader);
	if (options.mountedSlotsHeader) headers.set(VINEXT_MOUNTED_SLOTS_HEADER, options.mountedSlotsHeader);
	mergeMiddlewareResponseHeaders(headers, options.middlewareHeaders ?? null);
	return headers;
}
function getCachedAppPageValue(entry) {
	return entry?.value.value && entry.value.value.kind === "APP_PAGE" ? entry.value.value : null;
}
function hasQueryInvariantAppPageProof(cachedValue) {
	return cachedValue.renderObservation !== void 0 && hasCompleteNegativeRequestApiProof(cachedValue.renderObservation, ["searchParams"]);
}
function resolveRegeneratedAppPageCachePolicy(options) {
	let revalidateSeconds = options.routeRevalidateSeconds;
	const renderRevalidateSeconds = options.renderCacheControl?.revalidate;
	if (renderRevalidateSeconds !== void 0) revalidateSeconds = revalidateSeconds > 0 ? Math.min(revalidateSeconds, renderRevalidateSeconds) : renderRevalidateSeconds;
	return {
		expireSeconds: options.renderCacheControl?.expire ?? options.expireSeconds,
		revalidateSeconds
	};
}
function buildAppPageCachedResponse(cachedValue, options) {
	const status = options.middlewareStatus ?? (cachedValue.status || 200);
	const { cacheControl } = decideIsr({
		cacheState: options.cacheState,
		kind: "app-page",
		revalidateSeconds: options.revalidateSeconds,
		expireSeconds: options.expireSeconds,
		cacheControlMeta: options.cacheControl
	});
	if (options.isRscRequest) {
		if (!cachedValue.rscData) return null;
		const rscHeaders = buildAppPageCachedHeaders({
			cacheControl,
			cacheState: options.cacheState,
			contentType: VINEXT_RSC_CONTENT_TYPE,
			isEdgeRuntime: options.isEdgeRuntime,
			middlewareHeaders: options.middlewareHeaders,
			mountedSlotsHeader: options.mountedSlotsHeader
		});
		applyRscCompatibilityIdHeader(rscHeaders);
		applyRscDeploymentIdHeader(rscHeaders);
		return new Response(cachedValue.rscData, {
			status,
			headers: rscHeaders
		});
	}
	if (typeof cachedValue.html !== "string" || cachedValue.html.length === 0) return null;
	const htmlHeaders = buildAppPageCachedHeaders({
		cacheControl,
		cacheState: options.cacheState,
		contentType: "text/html; charset=utf-8",
		isEdgeRuntime: options.isEdgeRuntime,
		linkHeader: cachedValue.headers?.link,
		middlewareHeaders: options.middlewareHeaders
	});
	return new Response(cachedValue.html, {
		status,
		headers: htmlHeaders
	});
}
async function serveAppPageCachedHtml(options, transformValue) {
	if (typeof options.cachedValue.html !== "string" || options.cachedValue.html.length === 0) {
		if (options.cached?.isStale) options.scheduleRegeneration();
		options.isrDebug?.(options.emptyDebugMessage, options.pathname);
		return null;
	}
	const cacheState = options.cached?.isStale ? "STALE" : "HIT";
	if (options.cached?.isStale) options.scheduleRegeneration();
	const response = buildAppPageCachedResponse(transformValue ? transformValue(options.cachedValue) : options.cachedValue, {
		cacheState,
		cacheControl: options.cached?.value.cacheControl,
		expireSeconds: options.expireSeconds,
		isEdgeRuntime: options.isEdgeRuntime,
		isRscRequest: false,
		middlewareHeaders: options.middlewareHeaders,
		middlewareStatus: options.middlewareStatus,
		revalidateSeconds: options.revalidateSeconds
	});
	if (!response) return null;
	options.isrDebug?.(`${cacheState} (${options.stateDebugLabel})`, options.pathname);
	options.clearRequestContext();
	return response;
}
async function readAppPageCacheResponse(options) {
	if (options.isRscRequest && options.mountedSlotsHeader) {
		options.isrDebug?.("MISS (mounted slots RSC variant)", options.cleanPathname);
		return null;
	}
	const isrKey = options.isRscRequest ? options.isrRscKey(options.cleanPathname, null, options.renderMode, options.interceptionContext) : options.isrHtmlKey(options.cleanPathname);
	const artifact = options.isRscRequest ? "rsc" : "html";
	try {
		const cached = await options.isrGet(isrKey);
		const cachedValue = getCachedAppPageValue(cached);
		if (cached && !cachedValue) {
			recordAppPageCacheOutcome(options.recordCacheOutcome, {
				artifact,
				cacheKey: isrKey,
				outcome: "miss",
				reason: "non-app-page-entry"
			});
			options.isrDebug?.("MISS (non app-page cache entry)", options.cleanPathname);
			return null;
		}
		if (cachedValue && options.hasRequestSearchParams === true && !hasQueryInvariantAppPageProof(cachedValue)) {
			recordAppPageCacheOutcome(options.recordCacheOutcome, {
				artifact,
				cacheKey: isrKey,
				outcome: "miss",
				reason: "query-variant-unproven"
			});
			options.isrDebug?.("MISS (query-bearing request lacks cache proof)", options.cleanPathname);
			return null;
		}
		if (cachedValue && !cached?.isStale) {
			const hitResponse = buildAppPageCachedResponse(cachedValue, {
				cacheState: "HIT",
				cacheControl: cached?.value.cacheControl,
				expireSeconds: options.expireSeconds,
				isEdgeRuntime: options.isEdgeRuntime,
				isRscRequest: options.isRscRequest,
				middlewareHeaders: options.middlewareHeaders,
				middlewareStatus: options.middlewareStatus,
				mountedSlotsHeader: options.mountedSlotsHeader,
				revalidateSeconds: options.revalidateSeconds
			});
			if (hitResponse) {
				recordAppPageCacheOutcome(options.recordCacheOutcome, {
					artifact,
					cacheKey: isrKey,
					outcome: "hit",
					reason: "served"
				});
				options.isrDebug?.(options.isRscRequest ? "HIT (RSC)" : "HIT (HTML)", options.cleanPathname);
				options.clearRequestContext();
				return hitResponse;
			}
			recordAppPageCacheOutcome(options.recordCacheOutcome, {
				artifact,
				cacheKey: isrKey,
				outcome: "miss",
				reason: "empty-entry"
			});
			options.isrDebug?.("MISS (empty cached entry)", options.cleanPathname);
		}
		if (cached?.isStale && cachedValue) {
			options.scheduleBackgroundRegeneration(isrKey, async () => {
				const revalidatedPage = await options.renderFreshPageForCache();
				const cachePolicy = resolveRegeneratedAppPageCachePolicy({
					expireSeconds: options.expireSeconds,
					renderCacheControl: revalidatedPage.cacheControl,
					routeRevalidateSeconds: options.revalidateSeconds
				});
				const writes = [options.isrSet(options.isRscRequest ? isrKey : options.isrRscKey(options.cleanPathname, null, options.renderMode, options.interceptionContext), buildAppPageCacheValue("", revalidatedPage.rscData, 200, revalidatedPage.rscRenderObservation), cachePolicy.revalidateSeconds, revalidatedPage.tags, cachePolicy.expireSeconds)];
				if (!options.isRscRequest) writes.push(options.isrSet(isrKey, buildAppPageCacheValue(revalidatedPage.html, void 0, 200, revalidatedPage.htmlRenderObservation, revalidatedPage.linkHeader ? { link: revalidatedPage.linkHeader } : void 0), cachePolicy.revalidateSeconds, revalidatedPage.tags, cachePolicy.expireSeconds));
				await Promise.all(writes);
				options.isrDebug?.("regen complete", options.cleanPathname);
			});
			const staleResponse = buildAppPageCachedResponse(cachedValue, {
				cacheState: "STALE",
				cacheControl: cached.value.cacheControl,
				expireSeconds: options.expireSeconds,
				isEdgeRuntime: options.isEdgeRuntime,
				isRscRequest: options.isRscRequest,
				middlewareHeaders: options.middlewareHeaders,
				middlewareStatus: options.middlewareStatus,
				mountedSlotsHeader: options.mountedSlotsHeader,
				revalidateSeconds: options.revalidateSeconds
			});
			if (staleResponse) {
				recordAppPageCacheOutcome(options.recordCacheOutcome, {
					artifact,
					cacheKey: isrKey,
					outcome: "stale",
					reason: "served"
				});
				options.isrDebug?.(options.isRscRequest ? "STALE (RSC)" : "STALE (HTML)", options.cleanPathname);
				options.clearRequestContext();
				return staleResponse;
			}
			recordAppPageCacheOutcome(options.recordCacheOutcome, {
				artifact,
				cacheKey: isrKey,
				outcome: "miss",
				reason: "stale-empty-entry"
			});
			options.isrDebug?.("STALE MISS (empty stale entry)", options.cleanPathname);
		}
		if (!cached) {
			recordAppPageCacheOutcome(options.recordCacheOutcome, {
				artifact,
				cacheKey: isrKey,
				outcome: "miss",
				reason: "no-entry"
			});
			options.isrDebug?.("MISS (no cache entry)", options.cleanPathname);
		}
	} catch (isrReadError) {
		recordAppPageCacheOutcome(options.recordCacheOutcome, {
			artifact,
			cacheKey: isrKey,
			outcome: "miss",
			reason: "read-error"
		});
		console.error("[vinext] ISR cache read error:", isrReadError);
	}
	return null;
}
async function readAppPageFallbackShellCacheResponse(options) {
	const isrKey = options.isrHtmlKey(options.fallbackPathname);
	try {
		const cached = await options.isrGet(isrKey);
		const cachedValue = getCachedAppPageValue(cached);
		if (!cachedValue) {
			options.isrDebug?.("MISS (fallback shell)", options.fallbackPathname);
			return null;
		}
		if (isAppPprDynamicFallbackShellHtml(cachedValue.html)) {
			options.isrDebug?.("MISS (dynamic fallback shell requires resume)", options.fallbackPathname);
			return null;
		}
		return await serveAppPageCachedHtml({
			cached,
			cachedValue,
			clearRequestContext: options.clearRequestContext,
			emptyDebugMessage: "MISS (empty fallback shell)",
			expireSeconds: options.expireSeconds,
			isEdgeRuntime: options.isEdgeRuntime,
			isrDebug: options.isrDebug,
			middlewareHeaders: options.middlewareHeaders,
			middlewareStatus: options.middlewareStatus,
			pathname: options.fallbackPathname,
			revalidateSeconds: options.revalidateSeconds,
			scheduleRegeneration() {},
			stateDebugLabel: "fallback shell"
		}, (value) => ({
			...value,
			html: options.rewriteHtml(value.html)
		}));
	} catch (isrReadError) {
		options.isrDebug?.("MISS (fallback shell read error)", options.fallbackPathname);
		console.error("[vinext] ISR fallback shell cache read error:", isrReadError);
		return null;
	}
}
//#endregion
export { buildAppPageCacheTags, buildAppPageCachedResponse, finalizeAppPageHtmlCacheResponse, finalizeAppPageRscCacheResponse, readAppPageCacheResponse, readAppPageFallbackShellCacheResponse, scheduleAppPageRscCacheWrite };
