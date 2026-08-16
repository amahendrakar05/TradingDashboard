import { stripBasePath } from "../utils/base-path.js";
import { VINEXT_DYNAMIC_STALE_TIME_HEADER, VINEXT_MOUNTED_SLOTS_HEADER, VINEXT_PARAMS_HEADER, VINEXT_RENDERED_PATH_AND_SEARCH_HEADER } from "../server/headers.js";
import { assertSafeNavigationUrl } from "./url-safety.js";
import { isExternalUrl } from "../utils/external-url.js";
import { AppElementsWire } from "../server/app-elements-wire.js";
import "../server/app-elements.js";
import { markPprFallbackShellDynamicBoundary } from "./ppr-fallback-shell.js";
import { AppRouterContext } from "./internal/app-router-context.js";
import { resolveDirectHybridClientRouteOwner } from "./internal/hybrid-client-route-owner-direct.js";
import { toBrowserNavigationHref, toSameOriginAppPath, withBasePath } from "./url-utils.js";
import { retryScrollTo, scrollToHashTarget } from "./hash-scroll.js";
import { GLOBAL_ACCESSORS_KEY, ServerInsertedHTMLContext, _registerStateAccessors, clearClientHydrationContext, clearServerInsertedHTML, flushServerInsertedHTML, getBfcacheIdMapContext, getBfcacheSegmentIdContext, getLayoutSegmentContext, getNavigationContext, registerServerInsertedHTMLCallback, renderServerInsertedHTML, setNavigationContext } from "./navigation-context-state.js";
import { BailoutToCSRError, DynamicServerError, HTTP_ERROR_FALLBACK_ERROR_CODE, RedirectType, decodeRedirectError, forbidden, getAccessFallbackHTTPStatus, isBailoutToCSRError, isDynamicServerError, isHTTPAccessFallbackError, isNextRouterError, isRedirectError, notFound, permanentRedirect, redirect, unauthorized, unstable_rethrow } from "./navigation-errors.js";
import { isBotUserAgent } from "../utils/html-limited-bots.js";
import { clearAppNavigationFailureTarget, stageAppNavigationFailureTarget } from "../client/app-nav-failure-handler.js";
import { beginAppRouterScrollIntent, clearAppRouterScrollIntent, consumeAppRouterScrollIntent, getPendingAppRouterScrollIntent } from "./app-router-scroll-state.js";
import { VINEXT_RSC_COMPATIBILITY_ID_HEADER, createRscRequestHeaders, createRscRequestUrl, stripRscCacheBustingSearchParam, stripRscSuffix } from "../server/app-rsc-cache-busting.js";
import { getNavigationRuntime, hasAppNavigationRuntime } from "../client/navigation-runtime.js";
import { notifyAppRouterTransitionStart } from "../client/instrumentation-client-state.js";
import { PUBLIC_INITIAL_BFCACHE_ID } from "../server/app-bfcache-id.js";
import { resolveManifestNavigationInterceptionContext } from "../server/app-browser-interception-context.js";
import { createExternalHistoryStatePreservingMetadata, createHashOnlyHistoryStatePreservingNavigationMetadata } from "../server/app-history-state.js";
import { hasPendingAppRouterPageRedirect } from "../server/app-browser-mpa-navigation.js";
import { navigationPlanner } from "../server/navigation-planner.js";
import { ReadonlyURLSearchParams } from "./readonly-url-search-params.js";
import { getPagesNavigationContext } from "./internal/pages-router-accessor.js";
import { releaseAppPrefetchFetchSlot, scheduleAppPrefetchFetch } from "./internal/app-prefetch-fetch-queue.js";
import { UnrecognizedActionError, unstable_isUnrecognizedActionError } from "./unrecognized-action-error.js";
import * as React$1 from "react";
//#region src/shims/navigation.ts
/**
* next/navigation shim
*
* App Router navigation hooks. These work on both server (RSC) and client.
* Server-side: reads from a request context set by the RSC handler.
* Client-side: reads from browser Location API and provides navigation.
*/
const HAS_PAGES_ROUTER = process.env.__VINEXT_HAS_PAGES_ROUTER !== "false";
let hybridClientRouteOwnerModule = null;
let hybridClientRouteOwnerModulePromise = null;
/** Load rewrite-aware hybrid route ownership before navigation becomes interactive. */
async function preloadHybridClientRouteOwner() {
	if (hybridClientRouteOwnerModule) return;
	hybridClientRouteOwnerModulePromise ??= import("./internal/hybrid-client-route-owner.js");
	hybridClientRouteOwnerModule = await hybridClientRouteOwnerModulePromise;
}
function resolveLoadedHybridClientRewriteHref(href, basePath) {
	return hybridClientRouteOwnerModule?.resolveHybridClientRewriteHref(href, basePath) ?? null;
}
function resolveHybridClientRouteOwner(href) {
	if (!HAS_PAGES_ROUTER) return null;
	return hybridClientRouteOwnerModule ? hybridClientRouteOwnerModule.resolveHybridClientRouteOwner(href, __basePath) : resolveDirectHybridClientRouteOwner(href, __basePath);
}
/**
* Read the child segments for a parallel route below the current layout.
* Returns [] if no context is available (RSC environment, outside React tree)
* or if the requested key is not present in the segment map.
*/
function useChildSegments(parallelRoutesKey = "children") {
	const ctx = getLayoutSegmentContext();
	if (!ctx) return [];
	try {
		return (React$1.useContext(ctx)[parallelRoutesKey] ?? []).filter((segment) => !segment.startsWith("__PAGE__"));
	} catch {
		return [];
	}
}
const _READONLY_SEARCH_PARAMS = Symbol("vinext.navigation.readonlySearchParams");
const _READONLY_SEARCH_PARAMS_SOURCE = Symbol("vinext.navigation.readonlySearchParamsSource");
const _READONLY_SEARCH_PARAMS_SOURCE_KEY = Symbol("vinext.navigation.readonlySearchParamsSourceKey");
const PAGES_NAVIGATION_NOTIFY_KEY = Symbol.for("vinext.navigation.pagesNavigationNotify");
const isServer = typeof window === "undefined";
/** basePath from next.config.js, injected by the plugin at build time */
const __basePath = process.env.__NEXT_ROUTER_BASEPATH ?? "";
/** Maximum buffered bytes in the RSC prefetch cache. Mirrors Next.js' 50 MB LRU. */
const MAX_PREFETCH_CACHE_SIZE = 50 * 1024 * 1024;
const PREFETCH_CACHE_EVICTION_TARGET_SIZE = MAX_PREFETCH_CACHE_SIZE * .9;
/**
* TTL for prefetch cache entries in ms.
*
* Mirrors Next.js' `STATIC_STALETIME_MS` derivation. The plugin injects
* `process.env.__NEXT_CLIENT_ROUTER_STATIC_STALETIME` from
* `experimental.staleTimes.static` (in seconds) at build time; we convert
* to ms here.
*
* Falls back to vinext's historical default of 30s when the env var is
* absent (e.g. unit tests that import this module without going through
* the plugin's `define` pipeline). When the plugin is active and the user
* has not set `experimental.staleTimes`, Next.js' 300s default applies
* (see `resolveStaleTimes` in `config/next-config.ts`).
*/
function resolveClientRouterStaleTime(raw, fallbackMs) {
	if (raw === void 0 || raw === "") return fallbackMs;
	const seconds = Number(raw);
	if (!Number.isFinite(seconds) || seconds < 0) return fallbackMs;
	return seconds * 1e3;
}
const DYNAMIC_NAVIGATION_CACHE_TTL = resolveClientRouterStaleTime(process.env.__NEXT_CLIENT_ROUTER_DYNAMIC_STALETIME, 3e4);
const PREFETCH_CACHE_TTL = resolveClientRouterStaleTime(process.env.__NEXT_CLIENT_ROUTER_STATIC_STALETIME, 3e4);
const MIN_PREFETCH_STALE_TIME_MS = 3e4;
function getCurrentInterceptionContext() {
	if (isServer) return null;
	return stripBasePath(window.location.pathname, __basePath);
}
function getPrefetchInterceptionContext(targetHref) {
	if (isServer) return null;
	let targetUrl;
	try {
		targetUrl = new URL(targetHref, window.location.href);
	} catch {
		return null;
	}
	return resolveManifestNavigationInterceptionContext({
		basePath: __basePath,
		currentPathname: window.location.pathname,
		routeManifest: getNavigationRuntime()?.bootstrap.routeManifest ?? null,
		targetPathname: targetUrl.pathname
	});
}
function getCurrentNextUrl() {
	if (isServer) return "/";
	return window.location.pathname + window.location.search;
}
/** Get or create the shared in-memory RSC prefetch cache on window. */
function getPrefetchCache() {
	if (isServer) return /* @__PURE__ */ new Map();
	if (!window.__VINEXT_RSC_PREFETCH_CACHE__) window.__VINEXT_RSC_PREFETCH_CACHE__ = /* @__PURE__ */ new Map();
	return window.__VINEXT_RSC_PREFETCH_CACHE__;
}
/**
* Get or create the shared set of already-prefetched RSC URLs on window.
* Keyed by interception-aware cache key so distinct source routes do not alias.
*/
function getPrefetchedUrls() {
	if (isServer) return /* @__PURE__ */ new Set();
	if (!window.__VINEXT_RSC_PREFETCHED_URLS__) window.__VINEXT_RSC_PREFETCHED_URLS__ = /* @__PURE__ */ new Set();
	return window.__VINEXT_RSC_PREFETCHED_URLS__;
}
function isDynamicStaleTimeSeconds(value) {
	return typeof value === "number" && Number.isFinite(value) && Number.isInteger(value) && value >= 0;
}
function isCacheExpiresAt(value) {
	return typeof value === "number" && Number.isFinite(value) && value >= 0;
}
function parseDynamicStaleTimeSeconds(value) {
	if (value === null || value === "") return void 0;
	const seconds = Number(value);
	return isDynamicStaleTimeSeconds(seconds) ? seconds : void 0;
}
function resolveCachedRscResponseTtlMs(cached, fallbackTtlMs) {
	const seconds = cached.dynamicStaleTimeSeconds;
	if (!isDynamicStaleTimeSeconds(seconds)) return fallbackTtlMs;
	return seconds * 1e3;
}
function resolveCachedRscResponseExpiresAt(timestamp, cached, fallbackTtlMs) {
	if (isCacheExpiresAt(cached.expiresAt)) return cached.expiresAt;
	return timestamp + resolveCachedRscResponseTtlMs(cached, fallbackTtlMs);
}
function resolvePrefetchedRscResponseExpiresAt(timestamp, cached, fallbackTtlMs) {
	if (isCacheExpiresAt(cached.expiresAt)) return cached.expiresAt;
	const seconds = cached.dynamicStaleTimeSeconds;
	if (!isDynamicStaleTimeSeconds(seconds)) return timestamp + Math.max(fallbackTtlMs, MIN_PREFETCH_STALE_TIME_MS);
	return timestamp + Math.max(seconds * 1e3, MIN_PREFETCH_STALE_TIME_MS);
}
function resolvePrefetchCacheEntryExpiresAt(entry) {
	if (entry.expiresAt !== void 0) return entry.expiresAt;
	if (entry.snapshot) return resolveCachedRscResponseExpiresAt(entry.timestamp, entry.snapshot, PREFETCH_CACHE_TTL);
	return entry.timestamp + PREFETCH_CACHE_TTL;
}
function resolvePrefetchCacheEntryMountedSlotsHeader(entry) {
	if (entry.mountedSlotsHeader !== void 0) return entry.mountedSlotsHeader;
	return entry.snapshot?.mountedSlotsHeader ?? null;
}
function normalizeRscCacheLookupUrl(rscUrl) {
	try {
		const url = new URL(rscUrl, "http://vinext.local");
		stripRscCacheBustingSearchParam(url);
		return `${url.pathname}${url.search}`;
	} catch {
		return null;
	}
}
function normalizeRscCacheLookupPathname(rscUrl) {
	try {
		return stripRscSuffix(new URL(rscUrl, "http://vinext.local").pathname);
	} catch {
		return null;
	}
}
function parsePrefetchCacheKey(cacheKey) {
	const separatorIndex = cacheKey.indexOf("\0");
	if (separatorIndex === -1) return {
		interceptionContext: null,
		rscUrl: cacheKey
	};
	return {
		interceptionContext: cacheKey.slice(separatorIndex + 1),
		rscUrl: cacheKey.slice(0, separatorIndex)
	};
}
function isPrefetchCacheEntryCompatibleWithMountedSlots(entry, mountedSlotsHeader) {
	if (resolvePrefetchCacheEntryMountedSlotsHeader(entry) === mountedSlotsHeader) return true;
	return (entry.snapshot?.mountedSlotsHeader ?? null) === mountedSlotsHeader;
}
function findPrefetchCacheEntryForNavigation(rscUrl, interceptionContext, mountedSlotsHeader, additionalRscUrls = []) {
	const cache = getPrefetchCache();
	const rscUrls = [rscUrl, ...additionalRscUrls];
	for (const lookupRscUrl of rscUrls) {
		const exactCacheKey = AppElementsWire.encodeCacheKey(lookupRscUrl, interceptionContext);
		const exactEntry = cache.get(exactCacheKey);
		if (exactEntry && exactEntry.cacheForNavigation !== false && isPrefetchCacheEntryCompatibleWithMountedSlots(exactEntry, mountedSlotsHeader)) return {
			cacheKey: exactCacheKey,
			entry: exactEntry
		};
	}
	const normalizedTargets = new Set(rscUrls.map((lookupRscUrl) => normalizeRscCacheLookupUrl(lookupRscUrl)).filter((lookupRscUrl) => lookupRscUrl !== null));
	if (normalizedTargets.size === 0) return null;
	for (const [cacheKey, entry] of cache) {
		if (entry.cacheForNavigation === false) continue;
		const source = parsePrefetchCacheKey(cacheKey);
		if (source.interceptionContext !== interceptionContext) continue;
		const normalizedSource = normalizeRscCacheLookupUrl(source.rscUrl);
		if (normalizedSource === null || !normalizedTargets.has(normalizedSource)) continue;
		if (!isPrefetchCacheEntryCompatibleWithMountedSlots(entry, mountedSlotsHeader)) continue;
		return {
			cacheKey,
			entry
		};
	}
	return null;
}
function hasPrefetchCacheEntryForNavigation(rscUrl, interceptionContext = null, mountedSlotsHeader = null, options = {}) {
	const match = findPrefetchCacheEntryForNavigation(rscUrl, interceptionContext, mountedSlotsHeader, options.additionalRscUrls);
	if (match === null) return false;
	if (match.entry.pending !== void 0) {
		touchPrefetchCacheEntry(getPrefetchCache(), match.cacheKey, match.entry);
		return true;
	}
	if (resolvePrefetchCacheEntryExpiresAt(match.entry) > Date.now()) {
		touchPrefetchCacheEntry(getPrefetchCache(), match.cacheKey, match.entry);
		return true;
	}
	deletePrefetchCacheEntry(getPrefetchCache(), getPrefetchedUrls(), match.cacheKey, match.entry, options.notifyInvalidation ?? true);
	return false;
}
function hasSearchAgnosticPrefetchShellForRoute(rscUrl, interceptionContext = null, mountedSlotsHeader = null) {
	const normalizedTargetPathname = normalizeRscCacheLookupPathname(rscUrl);
	if (normalizedTargetPathname === null) return false;
	const cache = getPrefetchCache();
	for (const [cacheKey, entry] of cache) {
		if (entry.searchAgnosticShell !== true) continue;
		const source = parsePrefetchCacheKey(cacheKey);
		if (source.interceptionContext !== interceptionContext) continue;
		if (normalizeRscCacheLookupPathname(source.rscUrl) !== normalizedTargetPathname) continue;
		if (!isPrefetchCacheEntryCompatibleWithMountedSlots(entry, mountedSlotsHeader)) continue;
		if (entry.pending !== void 0) return true;
		if (resolvePrefetchCacheEntryExpiresAt(entry) > Date.now()) return true;
		deletePrefetchCacheEntry(cache, getPrefetchedUrls(), cacheKey, entry, true);
	}
	return false;
}
function getPrefetchCacheEntrySize(entry) {
	return entry.snapshot?.buffer.byteLength ?? entry.size ?? 0;
}
let trackedPrefetchCache = null;
let trackedPrefetchCacheByteSize = 0;
function getPrefetchCacheByteSize(cache) {
	if (trackedPrefetchCache === cache) return trackedPrefetchCacheByteSize;
	let total = 0;
	const seen = /* @__PURE__ */ new Set();
	for (const entry of cache.values()) {
		if (seen.has(entry)) continue;
		seen.add(entry);
		total += getPrefetchCacheEntrySize(entry);
	}
	trackedPrefetchCache = cache;
	trackedPrefetchCacheByteSize = total;
	return total;
}
function adjustPrefetchCacheByteSize(cache, delta) {
	if (trackedPrefetchCache !== cache) return;
	trackedPrefetchCacheByteSize = Math.max(0, trackedPrefetchCacheByteSize + delta);
}
function touchPrefetchCacheEntry(cache, cacheKey, entry) {
	if (cache.get(cacheKey) !== entry) return;
	cache.delete(cacheKey);
	cache.set(cacheKey, entry);
	for (const key of entry.cacheKeys ?? []) {
		if (key === cacheKey || cache.get(key) !== entry) continue;
		cache.delete(key);
		cache.set(key, entry);
	}
}
/**
* Evict prefetch cache entries if buffered payloads exceed the byte budget.
* Sweeps expired entries only after the cheap byte-budget check says cleanup is
* needed, then evicts least-recently-used entries down to the target size.
*/
function evictPrefetchCacheIfNeeded() {
	const cache = getPrefetchCache();
	let totalSize = getPrefetchCacheByteSize(cache);
	if (totalSize <= 52428800) return;
	const now = Date.now();
	const prefetched = getPrefetchedUrls();
	for (const [key, entry] of cache) if (resolvePrefetchCacheEntryExpiresAt(entry) <= now) deletePrefetchCacheEntry(cache, prefetched, key, entry, true);
	totalSize = getPrefetchCacheByteSize(cache);
	if (totalSize <= 52428800) return;
	let inspectedEntries = 0;
	while (totalSize > PREFETCH_CACHE_EVICTION_TARGET_SIZE && inspectedEntries < cache.size) {
		const oldest = cache.keys().next().value;
		if (oldest !== void 0) {
			const entry = cache.get(oldest);
			if (entry) {
				const entrySize = getPrefetchCacheEntrySize(entry);
				if (entry.pending !== void 0 && entrySize === 0) {
					touchPrefetchCacheEntry(cache, oldest, entry);
					inspectedEntries += 1;
					continue;
				}
				totalSize -= entrySize;
				deletePrefetchCacheEntry(cache, prefetched, oldest, entry, true);
				inspectedEntries = 0;
			} else {
				cache.delete(oldest);
				prefetched.delete(oldest);
				inspectedEntries += 1;
			}
		} else break;
	}
}
function clearPrefetchInvalidation(entry) {
	if (entry.invalidationTimer !== void 0) {
		clearTimeout(entry.invalidationTimer);
		entry.invalidationTimer = void 0;
	}
}
function notifyPrefetchInvalidated(entry) {
	clearPrefetchInvalidation(entry);
	const callbacks = entry.onInvalidateCallbacks;
	entry.onInvalidateCallbacks = void 0;
	if (callbacks === void 0) return;
	for (const onInvalidate of callbacks) try {
		onInvalidate();
	} catch (error) {
		if (typeof reportError === "function") reportError(error);
		else console.error(error);
	}
}
function deletePrefetchCacheEntry(cache, prefetched, cacheKey, entry, notify) {
	adjustPrefetchCacheByteSize(cache, -getPrefetchCacheEntrySize(entry));
	const cacheKeys = entry.cacheKeys ?? /* @__PURE__ */ new Set([cacheKey]);
	for (const key of cacheKeys) {
		if (cache.get(key) === entry) cache.delete(key);
		prefetched.delete(key);
	}
	entry.cacheKeys = void 0;
	if (notify) notifyPrefetchInvalidated(entry);
	else {
		clearPrefetchInvalidation(entry);
		entry.onInvalidateCallbacks = void 0;
	}
}
function invalidatePrefetchCacheEntry(cacheKey) {
	const cache = getPrefetchCache();
	const entry = cache.get(cacheKey);
	if (!entry) return;
	deletePrefetchCacheEntry(cache, getPrefetchedUrls(), cacheKey, entry, true);
}
function schedulePrefetchInvalidation(cacheKey, entry) {
	if (entry.onInvalidateCallbacks === void 0 || entry.onInvalidateCallbacks.size === 0) return;
	clearPrefetchInvalidation(entry);
	const delay = Math.max(0, resolvePrefetchCacheEntryExpiresAt(entry) - Date.now());
	entry.invalidationTimer = setTimeout(() => {
		invalidatePrefetchCacheEntry(cacheKey);
	}, delay);
}
function addPrefetchInvalidationCallback(entry, onInvalidate) {
	if (onInvalidate === void 0) return;
	if (entry.onInvalidateCallbacks === void 0) entry.onInvalidateCallbacks = /* @__PURE__ */ new Set();
	entry.onInvalidateCallbacks.add(onInvalidate);
}
function attachPrefetchInvalidationCallback(cacheKey, onInvalidate) {
	if (onInvalidate === void 0) return;
	const entry = getPrefetchCache().get(cacheKey);
	if (!entry) return;
	addPrefetchInvalidationCallback(entry, onInvalidate);
	if (entry.outcome === "cache-seeded") schedulePrefetchInvalidation(cacheKey, entry);
}
function invalidatePrefetchCache() {
	const cache = getPrefetchCache();
	const prefetched = getPrefetchedUrls();
	for (const [cacheKey, entry] of cache) deletePrefetchCacheEntry(cache, prefetched, cacheKey, entry, true);
	prefetched.clear();
	if (!isServer) getNavigationRuntime()?.functions.pingVisibleLinks?.();
}
function seedPrefetchResponseSnapshot(rscUrl, snapshot, interceptionContext = null, mountedSlotsHeader = null, fallbackTtlMs = DYNAMIC_NAVIGATION_CACHE_TTL) {
	const cacheKey = AppElementsWire.encodeCacheKey(rscUrl, interceptionContext);
	const cache = getPrefetchCache();
	const existing = cache.get(cacheKey);
	if (existing) deletePrefetchCacheEntry(cache, getPrefetchedUrls(), cacheKey, existing, false);
	const timestamp = Date.now();
	const entry = {
		cacheForNavigation: true,
		cacheKeys: /* @__PURE__ */ new Set([cacheKey]),
		expiresAt: resolveCachedRscResponseExpiresAt(timestamp, snapshot, fallbackTtlMs),
		mountedSlotsHeader,
		outcome: "cache-seeded",
		size: snapshot.buffer.byteLength,
		snapshot,
		timestamp
	};
	cache.set(cacheKey, entry);
	adjustPrefetchCacheByteSize(cache, snapshot.buffer.byteLength);
	getPrefetchedUrls().add(cacheKey);
	schedulePrefetchInvalidation(cacheKey, entry);
	evictPrefetchCacheIfNeeded();
}
function deletePrefetchResponseSnapshot(rscUrl, snapshot, interceptionContext = null) {
	const cacheKey = AppElementsWire.encodeCacheKey(rscUrl, interceptionContext);
	const cache = getPrefetchCache();
	const entry = cache.get(cacheKey);
	if (entry?.snapshot !== snapshot) return;
	deletePrefetchCacheEntry(cache, getPrefetchedUrls(), cacheKey, entry, false);
}
/**
* Store a prefetched RSC response in the cache by snapshotting it to an
* ArrayBuffer.  The snapshot completes asynchronously; during that window
* the entry is marked `pending` so consumePrefetchResponse() will skip it
* (the caller falls back to a fresh fetch, which is acceptable).
*
* Prefer prefetchRscResponse() for new call-sites — it handles the full
* prefetch lifecycle including dedup and explicit slot context.
* storePrefetchResponse() is kept for backward compatibility and test
* helpers. It is slot-unaware: the snapshot's mountedSlotsHeader comes
* from the response headers, not the caller, so consumePrefetchResponse
* may reject the entry if the caller's slot context differs.
*
* NB: Caller is responsible for managing getPrefetchedUrls() — this
* function only stores the response in the prefetch cache.
*/
function storePrefetchResponse(rscUrl, response, interceptionContext = null, options) {
	const cacheKey = AppElementsWire.encodeCacheKey(rscUrl, interceptionContext);
	const cache = getPrefetchCache();
	const prefetched = getPrefetchedUrls();
	const existing = cache.get(cacheKey);
	if (existing) deletePrefetchCacheEntry(cache, prefetched, cacheKey, existing, false);
	const entry = {
		cacheKeys: /* @__PURE__ */ new Set([cacheKey]),
		mountedSlotsHeader: null,
		outcome: "pending",
		timestamp: Date.now()
	};
	addPrefetchInvalidationCallback(entry, options?.onInvalidate);
	entry.pending = snapshotRscResponse(response).then((snapshot) => {
		if (cache.get(cacheKey) !== entry) return;
		const previousSize = getPrefetchCacheEntrySize(entry);
		entry.mountedSlotsHeader = snapshot.mountedSlotsHeader ?? null;
		entry.snapshot = snapshot;
		entry.size = snapshot.buffer.byteLength;
		adjustPrefetchCacheByteSize(cache, entry.size - previousSize);
		entry.expiresAt = resolveCachedRscResponseExpiresAt(entry.timestamp, snapshot, PREFETCH_CACHE_TTL);
		evictPrefetchCacheIfNeeded();
	}).catch(() => {
		deletePrefetchCacheEntry(cache, prefetched, cacheKey, entry, false);
	}).finally(() => {
		if (cache.get(cacheKey) !== entry) return;
		entry.pending = void 0;
		if (entry.snapshot) {
			entry.outcome = "cache-seeded";
			schedulePrefetchInvalidation(cacheKey, entry);
		}
	});
	cache.set(cacheKey, entry);
}
function createCachedRscResponseSnapshot(response, buffer, responseUrl = null) {
	const dynamicStaleTimeSeconds = parseDynamicStaleTimeSeconds(response.headers.get(VINEXT_DYNAMIC_STALE_TIME_HEADER));
	return {
		compatibilityIdHeader: response.headers.get(VINEXT_RSC_COMPATIBILITY_ID_HEADER),
		buffer,
		contentType: response.headers.get("content-type") ?? "text/x-component",
		...dynamicStaleTimeSeconds !== void 0 ? { dynamicStaleTimeSeconds } : {},
		mountedSlotsHeader: response.headers.get(VINEXT_MOUNTED_SLOTS_HEADER),
		paramsHeader: response.headers.get(VINEXT_PARAMS_HEADER),
		renderedPathAndSearch: parseRenderedPathAndSearchHeader(response.headers.get(VINEXT_RENDERED_PATH_AND_SEARCH_HEADER)),
		url: responseUrl ?? response.url
	};
}
function parseRenderedPathAndSearchHeader(value) {
	if (value === null || value === "") return null;
	try {
		const decoded = decodeURIComponent(value);
		return decoded.startsWith("/") ? decoded : null;
	} catch {
		return null;
	}
}
/**
* Snapshot an RSC response to an ArrayBuffer for caching and replay.
* Consumes the response body and stores it with content-type and URL metadata.
*/
async function snapshotRscResponse(response) {
	try {
		return createCachedRscResponseSnapshot(response, await response.arrayBuffer());
	} finally {
		releaseAppPrefetchFetchSlot(response);
	}
}
/**
* Reconstruct a Response from a cached RSC snapshot.
* Creates a new Response with the original ArrayBuffer so createFromFetch
* can consume the stream from scratch.
*
* NOTE: The reconstructed Response always has `url === ""` — the Response
* constructor does not accept a `url` option, and `response.url` is read-only
* set by the fetch infrastructure. Callers that need the original URL should
* read it from `cached.url` directly rather than from the restored Response.
*
* @param copy - When true (default), copies the ArrayBuffer so the cached
*   snapshot remains replayable (needed for the visited-response cache).
*   Pass false for single-consumption paths (e.g. prefetch cache entries
*   that are deleted after consumption) to avoid the extra allocation.
*/
function restoreRscResponse(cached, copy = true) {
	const headers = new Headers({ "content-type": cached.contentType });
	if (cached.mountedSlotsHeader != null) headers.set(VINEXT_MOUNTED_SLOTS_HEADER, cached.mountedSlotsHeader);
	if (cached.compatibilityIdHeader != null) headers.set(VINEXT_RSC_COMPATIBILITY_ID_HEADER, cached.compatibilityIdHeader);
	if (isDynamicStaleTimeSeconds(cached.dynamicStaleTimeSeconds)) headers.set(VINEXT_DYNAMIC_STALE_TIME_HEADER, String(cached.dynamicStaleTimeSeconds));
	if (cached.paramsHeader != null) headers.set(VINEXT_PARAMS_HEADER, cached.paramsHeader);
	if (cached.renderedPathAndSearch != null) headers.set(VINEXT_RENDERED_PATH_AND_SEARCH_HEADER, encodeURIComponent(cached.renderedPathAndSearch));
	return new Response(copy ? cached.buffer.slice(0) : cached.buffer, {
		status: 200,
		headers
	});
}
/**
* Prefetch an RSC response and snapshot it for later consumption.
* Stores the in-flight promise so immediate clicks can await it instead
* of firing a duplicate fetch.
* Enforces a maximum cache size to prevent unbounded memory growth on
* link-heavy pages.
*/
function prefetchRscResponse(rscUrl, fetchPromise, interceptionContext = null, mountedSlotsHeader = null, options, behavior = {}) {
	const cacheKey = AppElementsWire.encodeCacheKey(rscUrl, interceptionContext);
	const cache = getPrefetchCache();
	const prefetched = getPrefetchedUrls();
	const now = Date.now();
	const existing = cache.get(cacheKey);
	if (existing) deletePrefetchCacheEntry(cache, prefetched, cacheKey, existing, false);
	const entry = {
		cacheForNavigation: behavior.cacheForNavigation ?? true,
		cacheKeys: /* @__PURE__ */ new Set([cacheKey]),
		mountedSlotsHeader,
		optimisticRouteShell: behavior.optimisticRouteShell === true,
		outcome: "pending",
		prefetchKind: behavior.prefetchKind ?? (behavior.optimisticRouteShell === true ? "loading-shell" : "navigation"),
		searchAgnosticShell: behavior.searchAgnosticShell === true,
		timestamp: now
	};
	addPrefetchInvalidationCallback(entry, options?.onInvalidate);
	entry.pending = fetchPromise.then(async (response) => {
		if (response.ok) {
			const snapshot = await snapshotRscResponse(response);
			if (cache.get(cacheKey) !== entry) return;
			const previousSize = getPrefetchCacheEntrySize(entry);
			entry.snapshot = snapshot;
			entry.size = snapshot.buffer.byteLength;
			adjustPrefetchCacheByteSize(cache, entry.size - previousSize);
			entry.expiresAt = resolvePrefetchedRscResponseExpiresAt(entry.timestamp, entry.snapshot, behavior.fallbackTtlMs ?? PREFETCH_CACHE_TTL);
			addRenderedPathAndSearchPrefetchAlias(cache, prefetched, cacheKey, entry);
			evictPrefetchCacheIfNeeded();
		} else {
			releaseAppPrefetchFetchSlot(response);
			deletePrefetchCacheEntry(cache, prefetched, cacheKey, entry, false);
		}
	}).catch(() => {
		deletePrefetchCacheEntry(cache, prefetched, cacheKey, entry, false);
	}).finally(() => {
		if (cache.get(cacheKey) !== entry) return;
		entry.pending = void 0;
		if (entry.snapshot) {
			entry.outcome = "cache-seeded";
			schedulePrefetchInvalidation(cacheKey, entry);
		}
	});
	cache.set(cacheKey, entry);
	evictPrefetchCacheIfNeeded();
}
function addRenderedPathAndSearchPrefetchAlias(cache, prefetched, primaryCacheKey, entry) {
	if (entry.cacheForNavigation === false) return;
	const renderedPathAndSearch = entry.snapshot?.renderedPathAndSearch;
	if (!renderedPathAndSearch) return;
	const source = parsePrefetchCacheKey(primaryCacheKey);
	const aliasCacheKey = AppElementsWire.encodeCacheKey(renderedPathAndSearch, source.interceptionContext);
	if (aliasCacheKey === primaryCacheKey) return;
	const existing = cache.get(aliasCacheKey);
	if (existing && existing !== entry) deletePrefetchCacheEntry(cache, prefetched, aliasCacheKey, existing, false);
	entry.cacheKeys ??= /* @__PURE__ */ new Set([primaryCacheKey]);
	entry.cacheKeys.add(aliasCacheKey);
	cache.set(aliasCacheKey, entry);
	prefetched.add(aliasCacheKey);
}
function peekPrefetchResponseForNavigation(rscUrl, interceptionContext = null, mountedSlotsHeader = null) {
	const match = findPrefetchCacheEntryForNavigation(rscUrl, interceptionContext, mountedSlotsHeader);
	if (!match) return null;
	const { cacheKey, entry } = match;
	if (entry.pending || entry.outcome !== "cache-seeded") return null;
	if (entry.cacheForNavigation === false || !entry.snapshot) return null;
	if (resolvePrefetchCacheEntryExpiresAt(entry) <= Date.now()) {
		deletePrefetchCacheEntry(getPrefetchCache(), getPrefetchedUrls(), cacheKey, entry, true);
		return null;
	}
	if (entry.expiresAt !== void 0 || entry.snapshot.expiresAt !== void 0) return {
		...entry.snapshot,
		expiresAt: resolvePrefetchCacheEntryExpiresAt(entry)
	};
	return entry.snapshot;
}
/**
* Consume a prefetched response for a given rscUrl.
* Only returns settled (non-pending) snapshots synchronously.
* Returns null if the entry is still in flight or doesn't exist.
*/
function consumePrefetchResponse(rscUrl, interceptionContext = null, mountedSlotsHeader = null) {
	const cache = getPrefetchCache();
	const exactCacheKey = AppElementsWire.encodeCacheKey(rscUrl, interceptionContext);
	const exactEntry = cache.get(exactCacheKey);
	if (exactEntry && exactEntry.cacheForNavigation !== false && !isPrefetchCacheEntryCompatibleWithMountedSlots(exactEntry, mountedSlotsHeader)) deletePrefetchCacheEntry(cache, getPrefetchedUrls(), exactCacheKey, exactEntry, false);
	const match = findPrefetchCacheEntryForNavigation(rscUrl, interceptionContext, mountedSlotsHeader);
	if (!match) return null;
	const { cacheKey, entry } = match;
	return consumeMatchedPrefetchResponse(cacheKey, entry, mountedSlotsHeader);
}
function consumeMatchedPrefetchResponse(cacheKey, entry, mountedSlotsHeader) {
	if (entry.pending || entry.outcome !== "cache-seeded") return null;
	if (entry.cacheForNavigation === false) return null;
	deletePrefetchCacheEntry(getPrefetchCache(), getPrefetchedUrls(), cacheKey, entry, false);
	if (entry.snapshot) {
		if (!isPrefetchCacheEntryCompatibleWithMountedSlots(entry, mountedSlotsHeader)) return null;
		if (resolvePrefetchCacheEntryExpiresAt(entry) <= Date.now()) return null;
		if (entry.expiresAt !== void 0 || entry.snapshot.expiresAt !== void 0) return {
			...entry.snapshot,
			expiresAt: resolvePrefetchCacheEntryExpiresAt(entry)
		};
		return entry.snapshot;
	}
	return null;
}
async function consumePrefetchResponseForNavigation(rscUrl, interceptionContext = null, mountedSlotsHeader = null, options) {
	const cache = getPrefetchCache();
	const match = findPrefetchCacheEntryForNavigation(rscUrl, interceptionContext, mountedSlotsHeader, options?.additionalRscUrls);
	if (!match) return null;
	const { cacheKey, entry } = match;
	if (entry.pending !== void 0) {
		await entry.pending.catch(() => {});
		if (cache.get(cacheKey) !== entry) return null;
	}
	if (options?.shouldConsume?.() === false) return null;
	return consumeMatchedPrefetchResponse(cacheKey, entry, mountedSlotsHeader);
}
const _CLIENT_NAV_STATE_KEY = Symbol.for("vinext.clientNavigationState");
const _MOUNTED_SLOTS_HEADER_KEY = Symbol.for("vinext.mountedSlotsHeader");
function setMountedSlotsHeader(header) {
	if (isServer) return;
	const globalState = window;
	globalState[_MOUNTED_SLOTS_HEADER_KEY] = header;
}
function getMountedSlotsHeader() {
	if (isServer) return null;
	return window[_MOUNTED_SLOTS_HEADER_KEY] ?? null;
}
function getClientNavigationState() {
	if (isServer) return null;
	const globalState = window;
	globalState[_CLIENT_NAV_STATE_KEY] ??= {
		listeners: /* @__PURE__ */ new Set(),
		cachedSearch: window.location.search,
		cachedReadonlySearchParams: new ReadonlyURLSearchParams(window.location.search),
		cachedPathname: stripBasePath(window.location.pathname, __basePath),
		clientParams: {},
		clientParamsJson: "{}",
		pendingClientParams: null,
		pendingClientParamsJson: null,
		pendingPathname: null,
		pendingPathnameNavId: null,
		originalPushState: window.history.pushState.bind(window.history),
		originalReplaceState: window.history.replaceState.bind(window.history),
		patchInstalled: false,
		hasPendingNavigationUpdate: false,
		suppressUrlNotifyCount: 0,
		navigationSnapshotActiveCount: 0
	};
	return globalState[_CLIENT_NAV_STATE_KEY];
}
function notifyNavigationListeners() {
	const state = getClientNavigationState();
	if (!state) return;
	for (const fn of state.listeners) fn();
}
if (!isServer) globalThis[PAGES_NAVIGATION_NOTIFY_KEY] = notifyNavigationListeners;
let _cachedEmptyServerSearchParams = null;
const _readonlyPagesSearchParamsCache = /* @__PURE__ */ new WeakMap();
let _cachedReadonlyPagesSearchParamsKey = null;
let _cachedReadonlyPagesSearchParams = null;
function getReadonlyPagesSearchParams(searchParams) {
	const cached = _readonlyPagesSearchParamsCache.get(searchParams);
	if (cached) return cached;
	const key = searchParams.toString();
	if (_cachedReadonlyPagesSearchParamsKey === key && _cachedReadonlyPagesSearchParams) {
		_readonlyPagesSearchParamsCache.set(searchParams, _cachedReadonlyPagesSearchParams);
		return _cachedReadonlyPagesSearchParams;
	}
	const readonly = new ReadonlyURLSearchParams(searchParams);
	_readonlyPagesSearchParamsCache.set(searchParams, readonly);
	_cachedReadonlyPagesSearchParamsKey = key;
	_cachedReadonlyPagesSearchParams = readonly;
	return readonly;
}
/**
* Get cached pathname snapshot for useSyncExternalStore.
* Note: Returns cached value from ClientNavigationState, not live window.location.
* The cache is updated by syncCommittedUrlStateFromLocation() after navigation commits.
* This ensures referential stability and prevents infinite re-renders.
* External pushState/replaceState while URL notifications are suppressed won't
* be visible until the next commit.
*/
function getPathnameSnapshot() {
	const pagesCtx = getPagesNavigationContext();
	if (pagesCtx) return pagesCtx.pathname;
	return getClientNavigationState()?.cachedPathname ?? "/";
}
let _cachedEmptyClientSearchParams = null;
/**
* Get cached search params snapshot for useSyncExternalStore.
* Note: Returns cached value from ClientNavigationState, not live window.location.search.
* The cache is updated by syncCommittedUrlStateFromLocation() after navigation commits.
* This ensures referential stability and prevents infinite re-renders.
* External pushState/replaceState while URL notifications are suppressed won't
* be visible until the next commit.
*/
function getSearchParamsSnapshot() {
	if (getNavigationContext()) return getServerSearchParamsSnapshot();
	const pagesCtx = getPagesNavigationContext();
	if (pagesCtx) return getReadonlyPagesSearchParams(pagesCtx.searchParams);
	const cached = getClientNavigationState()?.cachedReadonlySearchParams;
	if (cached) return cached;
	if (_cachedEmptyClientSearchParams === null) _cachedEmptyClientSearchParams = new ReadonlyURLSearchParams();
	return _cachedEmptyClientSearchParams;
}
function syncCommittedUrlStateFromLocation() {
	const state = getClientNavigationState();
	if (!state) return false;
	let changed = false;
	const pathname = stripBasePath(window.location.pathname, __basePath);
	if (pathname !== state.cachedPathname) {
		state.cachedPathname = pathname;
		changed = true;
	}
	const search = window.location.search;
	if (search !== state.cachedSearch) {
		state.cachedSearch = search;
		state.cachedReadonlySearchParams = new ReadonlyURLSearchParams(search);
		changed = true;
	}
	return changed;
}
function getServerSearchParamsSnapshot() {
	const ctx = getNavigationContext();
	if (!ctx) {
		const pagesCtx = getPagesNavigationContext();
		if (pagesCtx) return getReadonlyPagesSearchParams(pagesCtx.searchParams);
		if (_cachedEmptyServerSearchParams === null) _cachedEmptyServerSearchParams = new ReadonlyURLSearchParams();
		return _cachedEmptyServerSearchParams;
	}
	const source = ctx.searchParams;
	const cached = ctx[_READONLY_SEARCH_PARAMS];
	const cachedSource = ctx[_READONLY_SEARCH_PARAMS_SOURCE];
	if (cached && cachedSource === source) return cached;
	const sourceKey = source.toString();
	if (cached && ctx[_READONLY_SEARCH_PARAMS_SOURCE_KEY] === sourceKey) {
		ctx[_READONLY_SEARCH_PARAMS_SOURCE] = source;
		return cached;
	}
	const readonly = new ReadonlyURLSearchParams(source);
	ctx[_READONLY_SEARCH_PARAMS] = readonly;
	ctx[_READONLY_SEARCH_PARAMS_SOURCE] = source;
	ctx[_READONLY_SEARCH_PARAMS_SOURCE_KEY] = sourceKey;
	return readonly;
}
/**
* Mark a navigation snapshot as active. Called before startTransition
* in renderNavigationPayload. While active, hooks prefer the snapshot
* context value over useSyncExternalStore. Uses a counter (not boolean)
* to handle overlapping navigations — rapid clicks can interleave
* activate/deactivate if multiple transitions are in flight.
*/
function activateNavigationSnapshot() {
	const state = getClientNavigationState();
	if (state) state.navigationSnapshotActiveCount++;
}
const _EMPTY_PARAMS = {};
const _CLIENT_NAV_RENDER_CTX_KEY = Symbol.for("vinext.clientNavigationRenderContext");
function getClientNavigationRenderContext() {
	if (typeof React$1.createContext !== "function") return null;
	const globalState = globalThis;
	if (!globalState[_CLIENT_NAV_RENDER_CTX_KEY]) globalState[_CLIENT_NAV_RENDER_CTX_KEY] = React$1.createContext(null);
	return globalState[_CLIENT_NAV_RENDER_CTX_KEY] ?? null;
}
/** @internal */
function useClientNavigationRenderSnapshot() {
	const ctx = getClientNavigationRenderContext();
	if (!ctx || typeof React$1.useContext !== "function") return null;
	try {
		return React$1.useContext(ctx);
	} catch {
		return null;
	}
}
function createClientNavigationRenderSnapshot(href, params) {
	const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost";
	const url = new URL(href, origin);
	return {
		pathname: stripBasePath(url.pathname, __basePath),
		searchParams: new ReadonlyURLSearchParams(url.search),
		params
	};
}
function createSnapshotPathAndSearch(snapshot) {
	const query = snapshot.searchParams.toString();
	return query === "" ? snapshot.pathname : `${snapshot.pathname}?${query}`;
}
let _fallbackClientParams = _EMPTY_PARAMS;
let _fallbackClientParamsJson = "{}";
function setClientParams(params) {
	const state = getClientNavigationState();
	if (!state) {
		const json = JSON.stringify(params);
		if (json !== _fallbackClientParamsJson) {
			_fallbackClientParams = params;
			_fallbackClientParamsJson = json;
		}
		return;
	}
	const json = JSON.stringify(params);
	if (json !== state.clientParamsJson) {
		state.clientParams = params;
		state.clientParamsJson = json;
		state.pendingClientParams = null;
		state.pendingClientParamsJson = null;
		notifyNavigationListeners();
	}
}
function replaceClientParamsWithoutNotify(params) {
	const state = getClientNavigationState();
	if (!state) return;
	const json = JSON.stringify(params);
	if (json !== state.clientParamsJson && json !== state.pendingClientParamsJson) {
		state.pendingClientParams = params;
		state.pendingClientParamsJson = json;
		state.hasPendingNavigationUpdate = true;
	}
}
/** Get the current client params (for testing referential stability). */
function getClientParams() {
	return getClientNavigationState()?.clientParams ?? _fallbackClientParams;
}
/**
* Set the pending pathname for client-side navigation.
* Strips the base path before storing. Associates the pathname with the given navId
* so only that navigation (or a newer one) can clear it.
*/
function setPendingPathname(pathname, navId) {
	const state = getClientNavigationState();
	if (!state) return;
	state.pendingPathname = stripBasePath(pathname, __basePath);
	state.pendingPathnameNavId = navId;
}
/**
* Clear the pending pathname, but only if the given navId matches the one
* that set it, or if pendingPathnameNavId is null (no active owner).
* This prevents superseded navigations from clearing state belonging to newer navigations.
*/
function clearPendingPathname(navId) {
	const state = getClientNavigationState();
	if (!state) return;
	if (state.pendingPathnameNavId === null || state.pendingPathnameNavId === navId) {
		state.pendingPathname = null;
		state.pendingPathnameNavId = null;
	}
}
function getClientParamsSnapshot() {
	const state = getClientNavigationState();
	const ctx = getNavigationContext();
	if (ctx) return ctx.params;
	const pagesCtx = getPagesNavigationContext();
	if (pagesCtx) return pagesCtx.params;
	return state?.clientParams ?? _EMPTY_PARAMS;
}
function getServerParamsSnapshot() {
	const ctx = getNavigationContext();
	if (ctx) return ctx.params;
	const pagesCtx = getPagesNavigationContext();
	if (pagesCtx) return pagesCtx.params;
	return _EMPTY_PARAMS;
}
function subscribeToNavigation(cb) {
	const state = getClientNavigationState();
	if (!state) return () => {};
	state.listeners.add(cb);
	return () => {
		state.listeners.delete(cb);
	};
}
/**
* Returns the current pathname.
* Server: from request context. Client: from window.location.
*/
function usePathname() {
	if (isServer) {
		markPprFallbackShellDynamicBoundary();
		const ctx = getNavigationContext();
		if (ctx) return ctx.pathname;
		const pagesCtx = getPagesNavigationContext();
		return pagesCtx ? pagesCtx.pathname : "/";
	}
	const renderSnapshot = useClientNavigationRenderSnapshot();
	const pathname = React$1.useSyncExternalStore(subscribeToNavigation, getPathnameSnapshot, () => {
		const ctx = getNavigationContext();
		if (ctx) return ctx.pathname;
		const pagesCtx = getPagesNavigationContext();
		return pagesCtx ? pagesCtx.pathname : "/";
	});
	if (renderSnapshot && (getClientNavigationState()?.navigationSnapshotActiveCount ?? 0) > 0) return renderSnapshot.pathname;
	return pathname;
}
/**
* Returns the current search params as a read-only URLSearchParams.
*/
function useSearchParams() {
	if (isServer) {
		markPprFallbackShellDynamicBoundary();
		return getServerSearchParamsSnapshot();
	}
	const renderSnapshot = useClientNavigationRenderSnapshot();
	const searchParams = React$1.useSyncExternalStore(subscribeToNavigation, getSearchParamsSnapshot, getServerSearchParamsSnapshot);
	if (renderSnapshot && (getClientNavigationState()?.navigationSnapshotActiveCount ?? 0) > 0) return renderSnapshot.searchParams;
	return searchParams;
}
/**
* Returns the dynamic params for the current route.
*/
function useParams() {
	if (isServer) {
		markPprFallbackShellDynamicBoundary();
		return getServerParamsSnapshot();
	}
	const renderSnapshot = useClientNavigationRenderSnapshot();
	const params = React$1.useSyncExternalStore(subscribeToNavigation, getClientParamsSnapshot, getServerParamsSnapshot);
	if (renderSnapshot && (getClientNavigationState()?.navigationSnapshotActiveCount ?? 0) > 0) return renderSnapshot.params;
	return params;
}
function withSuppressedUrlNotifications(fn) {
	const state = getClientNavigationState();
	if (!state) return fn();
	state.suppressUrlNotifyCount += 1;
	try {
		return fn();
	} finally {
		state.suppressUrlNotifyCount -= 1;
	}
}
/**
* Commit pending client navigation state to committed snapshots.
*
* navId is optional: callers that don't own pendingPathname (for example,
* superseded pre-paint cleanup) may pass undefined to flush URL/params state
* without clearing pendingPathname owned by the active navigation. Such callers
* must opt in explicitly if they also own an activated render snapshot.
*/
function commitClientNavigationState(navId, options) {
	if (isServer) return;
	const state = getClientNavigationState();
	if (!state) return;
	if ((options?.releaseSnapshot ?? navId !== void 0) && state.navigationSnapshotActiveCount > 0) state.navigationSnapshotActiveCount -= 1;
	const urlChanged = syncCommittedUrlStateFromLocation();
	let paramsChanged = false;
	if (state.pendingClientParams !== null && state.pendingClientParamsJson !== null) {
		state.clientParams = state.pendingClientParams;
		state.clientParamsJson = state.pendingClientParamsJson;
		state.pendingClientParams = null;
		state.pendingClientParamsJson = null;
		paramsChanged = true;
	}
	if (state.pendingPathnameNavId === null || navId !== void 0 && state.pendingPathnameNavId === navId) {
		state.pendingPathname = null;
		state.pendingPathnameNavId = null;
	}
	const shouldNotify = urlChanged || state.hasPendingNavigationUpdate;
	state.hasPendingNavigationUpdate = false;
	if (urlChanged || paramsChanged) clearClientHydrationContext();
	if (shouldNotify) notifyNavigationListeners();
}
function pushHistoryStateWithoutNotify(data, unused, url) {
	withSuppressedUrlNotifications(() => {
		getClientNavigationState()?.originalPushState.call(window.history, data, unused, url);
	});
}
function replaceHistoryStateWithoutNotify(data, unused, url) {
	withSuppressedUrlNotifications(() => {
		getClientNavigationState()?.originalReplaceState.call(window.history, data, unused, url);
	});
}
/**
* Save the current scroll position into the current history state.
* Called before every navigation to enable scroll restoration on back/forward.
*
* Uses replaceHistoryStateWithoutNotify to avoid triggering the patched
* history.replaceState interception (which would cause spurious re-renders).
*/
function saveScrollPosition() {
	replaceHistoryStateWithoutNotify({
		...window.history.state ?? {},
		__vinext_scrollX: window.scrollX,
		__vinext_scrollY: window.scrollY
	}, "");
}
function commitHashOnlyHistoryState(href, mode, scroll) {
	const commitAppRouterHashNavigation = getNavigationRuntime()?.functions.commitHashNavigation;
	if (commitAppRouterHashNavigation) {
		commitAppRouterHashNavigation(href, mode, scroll);
		return;
	}
	const historyState = createHashOnlyHistoryStatePreservingNavigationMetadata(window.history.state);
	if (mode === "replace") replaceHistoryStateWithoutNotify(historyState, "", href);
	else pushHistoryStateWithoutNotify(historyState, "", href);
}
function applyAppRouterScrollFallback(intent) {
	if (typeof document === "undefined" || typeof window === "undefined") return;
	if (intent.hash !== null) {
		scrollToHashTarget(intent.hash);
		return;
	}
	if (intent.targetHoistedInHead) return;
	document.documentElement.scrollTop = 0;
}
function scheduleAppRouterScrollFallback(intent) {
	queueMicrotask(() => {
		const pendingIntent = getPendingAppRouterScrollIntent();
		if (pendingIntent === null || pendingIntent.id !== intent.id) return;
		const fallbackIntent = consumeAppRouterScrollIntent(intent);
		if (fallbackIntent) applyAppRouterScrollFallback(fallbackIntent);
	});
}
/**
* Restore scroll position from a history state object (used on popstate).
*
* When an RSC navigation is in flight (back/forward triggers both this
* handler and the browser entry's popstate handler which calls the registered
* navigation runtime), we must wait for the new content to render
* before scrolling. Otherwise the user sees old content flash at the
* restored scroll position.
*
* This handler fires before the browser entry's popstate handler (because
* navigation.ts is loaded before hydration completes), so we defer via a
* microtask to give the browser entry handler a chance to set
* __VINEXT_RSC_PENDING__. Promise.resolve() schedules a microtask
* that runs after all synchronous event listeners have completed.
*/
function restoreScrollPosition(state) {
	if (state && typeof state === "object" && "__vinext_scrollY" in state) {
		const { __vinext_scrollX: x, __vinext_scrollY: y } = state;
		Promise.resolve().then(() => {
			const pending = window.__VINEXT_RSC_PENDING__ ?? null;
			if (pending) pending.then(() => retryScrollTo(x, y));
			else retryScrollTo(x, y);
		});
	}
}
/**
* Hard-navigate to a URL via `window.location`, preserving push/replace
* semantics. Used for URLs the App Router cannot serve (Pages-owned
* targets in a hybrid build) and for catch-all RSC failures.
*/
function hardNavigateTo(fullHref, mode) {
	if (mode === "replace") window.location.replace(fullHref);
	else window.location.assign(fullHref);
}
/**
* Navigate to a URL, handling external URLs, hash-only changes, and RSC navigation.
*/
async function navigateClientSide(href, mode, scroll, programmaticTransition = false, visibleCommitMode = "transition") {
	getNavigationRuntime()?.functions.notifyLinkNavigationStart?.();
	let normalizedHref = href;
	if (isExternalUrl(href)) {
		const localPath = toSameOriginAppPath(href, __basePath);
		if (localPath == null) {
			notifyAppRouterTransitionStart(href, mode);
			const externalNavigate = getNavigationRuntime()?.functions.navigateExternal;
			if (externalNavigate) {
				await externalNavigate(href, mode);
				return;
			}
			hardNavigateTo(href, mode);
			await new Promise(() => {});
			return;
		}
		normalizedHref = localPath;
	}
	const hybridOwner = resolveHybridClientRouteOwner(normalizedHref);
	if (hybridOwner === "pages" || hybridOwner === "document") {
		const fullHref = toBrowserNavigationHref(normalizedHref, window.location.href, __basePath);
		notifyAppRouterTransitionStart(fullHref, mode);
		if (mode === "push") saveScrollPosition();
		hardNavigateTo(fullHref, mode);
		await new Promise(() => {});
		return;
	}
	const fullHref = toBrowserNavigationHref(normalizedHref, window.location.href, __basePath);
	stageAppNavigationFailureTarget(fullHref);
	notifyAppRouterTransitionStart(fullHref, mode);
	if (mode === "push") saveScrollPosition();
	const earlyIntent = navigationPlanner.classifyEarlyNavigationIntent({
		basePath: __basePath,
		currentHref: window.location.href,
		mode,
		scroll,
		targetHref: fullHref
	});
	if (earlyIntent.kind === "sameDocumentScroll") {
		clearAppRouterScrollIntent();
		commitHashOnlyHistoryState(fullHref, earlyIntent.mode, earlyIntent.scroll);
		clearAppNavigationFailureTarget(fullHref);
		commitClientNavigationState();
		if (earlyIntent.scroll) scrollToHashTarget(earlyIntent.hash);
		return;
	}
	if (hasPendingAppRouterPageRedirect(typeof document === "undefined" ? void 0 : document)) {
		const mpaNavigate = getNavigationRuntime()?.functions.navigateExternal;
		if (mpaNavigate) {
			await mpaNavigate(fullHref, mode);
			return;
		}
		hardNavigateTo(fullHref, mode);
		await new Promise(() => {});
		return;
	}
	const hashIdx = fullHref.indexOf("#");
	const hash = hashIdx !== -1 ? fullHref.slice(hashIdx) : "";
	const scrollIntent = scroll ? beginAppRouterScrollIntent(hash || null) : null;
	if (!scroll) clearAppRouterScrollIntent();
	const appNavigate = getNavigationRuntime()?.functions.navigate;
	try {
		if (appNavigate) await appNavigate(fullHref, 0, "navigate", mode, void 0, programmaticTransition, void 0, scrollIntent, visibleCommitMode);
		else {
			if (mode === "replace") replaceHistoryStateWithoutNotify(null, "", fullHref);
			else pushHistoryStateWithoutNotify(null, "", fullHref);
			commitClientNavigationState();
		}
	} catch (error) {
		if (scrollIntent) consumeAppRouterScrollIntent(scrollIntent);
		throw error;
	}
	if (scrollIntent) scheduleAppRouterScrollFallback(scrollIntent);
}
let scheduledAppRouterNavigationCount = 0;
function trackScheduledAppRouterNavigation() {
	scheduledAppRouterNavigationCount += 1;
	let released = false;
	return () => {
		if (released) return;
		released = true;
		scheduledAppRouterNavigationCount = Math.max(0, scheduledAppRouterNavigationCount - 1);
	};
}
function hasScheduledAppRouterNavigation() {
	return scheduledAppRouterNavigationCount > 0;
}
function releaseScheduledAppRouterNavigationAfterCurrentTask(release) {
	queueMicrotask(release);
}
/**
* App Router public router instance. Mirrors Next.js's
* `publicAppRouterInstance` from
* `packages/next/src/client/components/app-router-instance.ts`.
*
* Exported so the App Router browser entry can install it on
* `window.next.router` for Next.js parity (see `client/window-next.ts`).
* Internal callers in this file continue to use `_appRouter` for brevity.
*/
const _appRouter = {
	bfcacheId: "0",
	push(href, options) {
		assertSafeNavigationUrl(href);
		if (isServer) return;
		getNavigationRuntime()?.functions.notifyLinkNavigationStart?.();
		const releaseNavigation = trackScheduledAppRouterNavigation();
		try {
			React$1.startTransition(() => {
				navigateClientSide(href, "push", options?.scroll !== false, true);
			});
		} catch (error) {
			releaseNavigation();
			throw error;
		}
		releaseScheduledAppRouterNavigationAfterCurrentTask(releaseNavigation);
	},
	replace(href, options) {
		assertSafeNavigationUrl(href);
		if (isServer) return;
		getNavigationRuntime()?.functions.notifyLinkNavigationStart?.();
		const releaseNavigation = trackScheduledAppRouterNavigation();
		try {
			React$1.startTransition(() => {
				navigateClientSide(href, "replace", options?.scroll !== false, true);
			});
		} catch (error) {
			releaseNavigation();
			throw error;
		}
		releaseScheduledAppRouterNavigationAfterCurrentTask(releaseNavigation);
	},
	back() {
		if (isServer) return;
		window.history.back();
	},
	forward() {
		if (isServer) return;
		window.history.forward();
	},
	refresh() {
		if (isServer) return;
		getNavigationRuntime()?.functions.clearNavigationCaches?.();
		if (hasScheduledAppRouterNavigation()) return;
		const rscNavigate = getNavigationRuntime()?.functions.navigate;
		if (rscNavigate) {
			const navigate = () => {
				rscNavigate(window.location.href, 0, "refresh", void 0, void 0, true);
			};
			React$1.startTransition(navigate);
		}
	},
	prefetch(href, options) {
		assertSafeNavigationUrl(href);
		if (isServer) return;
		if (isBotUserAgent(window.navigator?.userAgent ?? "")) return;
		try {
			new URL(withBasePath(href, __basePath), window.location.href);
		} catch {
			throw new Error(`Cannot prefetch '${href}' because it cannot be converted to a URL.`);
		}
		(async () => {
			let prefetchHref = href;
			if (isExternalUrl(href)) {
				const localPath = toSameOriginAppPath(href, __basePath);
				if (localPath == null) return;
				prefetchHref = localPath;
			}
			const hybridOwner = resolveHybridClientRouteOwner(prefetchHref);
			if (hybridOwner === "pages" || hybridOwner === "document") return;
			const fullHref = toBrowserNavigationHref(prefetchHref, window.location.href, __basePath);
			const interceptionContext = getPrefetchInterceptionContext(fullHref);
			const mountedSlotsHeader = getMountedSlotsHeader();
			const headers = createRscRequestHeaders({ interceptionContext });
			if (mountedSlotsHeader) headers.set(VINEXT_MOUNTED_SLOTS_HEADER, mountedSlotsHeader);
			const rscUrl = await createRscRequestUrl(fullHref, headers);
			const cacheKey = AppElementsWire.encodeCacheKey(rscUrl, interceptionContext);
			const prefetched = getPrefetchedUrls();
			if (prefetched.has(cacheKey)) {
				attachPrefetchInvalidationCallback(cacheKey, options?.onInvalidate);
				return;
			}
			prefetched.add(cacheKey);
			prefetchRscResponse(rscUrl, scheduleAppPrefetchFetch(() => fetch(rscUrl, {
				headers,
				credentials: "include",
				priority: "low"
			}), "low"), interceptionContext, mountedSlotsHeader, options);
		})().catch((error) => {
			console.error("[vinext] RSC prefetch setup error:", error);
		});
	}
};
if (process.env.__NEXT_GESTURE_TRANSITION) _appRouter.experimental_gesturePush = (href, options) => {
	assertSafeNavigationUrl(href);
	if (isServer) return;
	if (!getNavigationRuntime()?.functions.navigate) return;
	let appHref = href;
	if (isExternalUrl(href)) {
		const localPath = toSameOriginAppPath(href, __basePath);
		if (localPath === null) return;
		appHref = localPath;
	}
	const releaseNavigation = trackScheduledAppRouterNavigation();
	navigateClientSide(appHref, "push", options?.scroll !== false, false, "synchronous");
	releaseScheduledAppRouterNavigationAfterCurrentTask(releaseNavigation);
};
function formatPublicBfcacheId(value) {
	if (!value || value === "0") return PUBLIC_INITIAL_BFCACHE_ID;
	return value;
}
function readBfcacheIdFromContext() {
	const segmentContext = getBfcacheSegmentIdContext();
	const idMapContext = getBfcacheIdMapContext();
	if (!segmentContext || !idMapContext || typeof React$1.useContext !== "function") return formatPublicBfcacheId(null);
	try {
		const segmentId = React$1.useContext(segmentContext);
		const idMap = React$1.useContext(idMapContext);
		return formatPublicBfcacheId(segmentId !== null ? idMap?.[segmentId] : null);
	} catch (error) {
		if (process.env.NODE_ENV !== "production") console.warn("[vinext] readBfcacheIdFromContext failed:", error);
		return formatPublicBfcacheId(null);
	}
}
/**
* Public App Router instance, exposed for the browser entry so it can wire
* `window.next.router` to the same singleton returned from `useRouter()`.
*
* Mirrors `publicAppRouterInstance` from Next.js's
* `packages/next/src/client/components/app-router-instance.ts` (line 392).
*/
const appRouterInstance = _appRouter;
/**
* App Router's useRouter — returns push/replace/back/forward/refresh.
* Different from Pages Router's useRouter (next/router).
*
* Preserves the mounted AppRouterContext router as the authority for methods
* and layers the nearest segment's contextual `bfcacheId` on top.
*/
function useRouter() {
	if (!AppRouterContext || typeof React$1.useContext !== "function" || typeof React$1.useMemo !== "function") throw new Error("invariant expected app router to be mounted");
	const router = React$1.useContext(AppRouterContext);
	if (router === null) throw new Error("invariant expected app router to be mounted");
	const bfcacheId = readBfcacheIdFromContext();
	return React$1.useMemo(() => ({
		...router,
		bfcacheId
	}), [router, bfcacheId]);
}
/**
* Returns the active child segment one level below the layout where it's called.
*
* Returns the first segment from the route tree below this layout, including
* route groups (e.g., "(marketing)") and resolved dynamic params. Returns null
* if at the leaf (no child segments).
*
* @param parallelRoutesKey - Which parallel route to read (default: "children")
*/
function useSelectedLayoutSegment(parallelRoutesKey) {
	const segments = useSelectedLayoutSegments(parallelRoutesKey);
	if (segments.length === 0) return null;
	return parallelRoutesKey === void 0 || parallelRoutesKey === "children" ? segments[0] : segments[segments.length - 1];
}
/**
* Returns all active segments below the layout where it's called.
*
* Each layout in the App Router tree wraps its children with a
* LayoutSegmentProvider whose value is a map of parallel route key to
* segment arrays. The "children" key is the default parallel route.
*
* @param parallelRoutesKey - Which parallel route to read (default: "children")
*/
function useSelectedLayoutSegments(parallelRoutesKey) {
	if (isServer) markPprFallbackShellDynamicBoundary();
	return useChildSegments(parallelRoutesKey);
}
/**
* useServerInsertedHTML — inject HTML during SSR from client components.
*
* Used by CSS-in-JS libraries (styled-components, emotion, StyleX) to inject
* <style> tags during SSR so styles appear in the initial HTML (no FOUC).
*
* The callback is called once after each SSR render pass. The returned JSX/HTML
* is serialized and injected into the HTML stream.
*
* Usage (in a "use client" component wrapping children):
*   useServerInsertedHTML(() => {
*     const styles = sheet.getStyleElement();
*     sheet.instance.clearTag();
*     return <>{styles}</>;
*   });
*/
function useServerInsertedHTML(callback) {
	if (typeof document !== "undefined") return;
	registerServerInsertedHTMLCallback(callback);
}
if (!isServer) {
	const state = getClientNavigationState();
	if (state && !state.patchInstalled) {
		state.patchInstalled = true;
		window.addEventListener("popstate", () => {
			getNavigationRuntime()?.functions.notifyLinkNavigationStart?.();
		});
		window.addEventListener("popstate", (event) => {
			if (!hasAppNavigationRuntime()) {
				commitClientNavigationState();
				restoreScrollPosition(event.state);
			}
		});
		window.history.pushState = function patchedPushState(data, unused, url) {
			state.originalPushState.call(window.history, createExternalHistoryStatePreservingMetadata(data, window.history.state), unused, url);
			if (state.suppressUrlNotifyCount === 0) {
				getNavigationRuntime()?.functions.notifyLinkNavigationStart?.();
				commitClientNavigationState();
			}
		};
		window.history.replaceState = function patchedReplaceState(data, unused, url) {
			state.originalReplaceState.call(window.history, createExternalHistoryStatePreservingMetadata(data, window.history.state), unused, url);
			if (state.suppressUrlNotifyCount === 0) {
				getNavigationRuntime()?.functions.notifyLinkNavigationStart?.();
				commitClientNavigationState();
			}
		};
	}
}
//#endregion
export { BailoutToCSRError, DYNAMIC_NAVIGATION_CACHE_TTL, DynamicServerError, GLOBAL_ACCESSORS_KEY, HTTP_ERROR_FALLBACK_ERROR_CODE, MAX_PREFETCH_CACHE_SIZE, PREFETCH_CACHE_TTL, ReadonlyURLSearchParams, RedirectType, ServerInsertedHTMLContext, UnrecognizedActionError, __basePath, _registerStateAccessors, activateNavigationSnapshot, appRouterInstance, applyAppRouterScrollFallback, clearPendingPathname, clearServerInsertedHTML, commitClientNavigationState, consumePrefetchResponse, consumePrefetchResponseForNavigation, createCachedRscResponseSnapshot, createClientNavigationRenderSnapshot, createSnapshotPathAndSearch, decodeRedirectError, deletePrefetchResponseSnapshot, flushServerInsertedHTML, forbidden, getAccessFallbackHTTPStatus, getBfcacheIdMapContext, getBfcacheSegmentIdContext, getClientNavigationRenderContext, getClientNavigationState, getClientParams, getCurrentInterceptionContext, getCurrentNextUrl, getLayoutSegmentContext, getMountedSlotsHeader, getNavigationContext, getPrefetchCache, getPrefetchInterceptionContext, getPrefetchedUrls, hasPrefetchCacheEntryForNavigation, hasSearchAgnosticPrefetchShellForRoute, invalidatePrefetchCache, isBailoutToCSRError, isDynamicServerError, isHTTPAccessFallbackError, isNextRouterError, isRedirectError, navigateClientSide, notFound, peekPrefetchResponseForNavigation, permanentRedirect, prefetchRscResponse, preloadHybridClientRouteOwner, pushHistoryStateWithoutNotify, redirect, renderServerInsertedHTML, replaceClientParamsWithoutNotify, replaceHistoryStateWithoutNotify, resolveCachedRscResponseExpiresAt, resolveCachedRscResponseTtlMs, resolveLoadedHybridClientRewriteHref, resolvePrefetchCacheEntryMountedSlotsHeader, restoreRscResponse, saveScrollPosition, seedPrefetchResponseSnapshot, setClientParams, setMountedSlotsHeader, setNavigationContext, setPendingPathname, snapshotRscResponse, storePrefetchResponse, unauthorized, unstable_isUnrecognizedActionError, unstable_rethrow, useClientNavigationRenderSnapshot, useParams, usePathname, useRouter, useSearchParams, useSelectedLayoutSegment, useSelectedLayoutSegments, useServerInsertedHTML };
