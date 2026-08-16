"use client";
import { stripBasePath } from "../utils/base-path.js";
import { createRouteTrieCache, matchRouteWithTrie } from "../routing/route-matching.js";
import { isDangerousScheme, reportBlockedDangerousNavigation } from "./url-safety.js";
import { addLocalePrefix, getDomainLocaleUrl } from "../utils/domain-locale.js";
import { getPagesMiddlewareDataHref, prefetchPagesData, resolvePagesDataNavigationTarget } from "./internal/pages-data-target.js";
import { markAppRouteDetectedOnPrefetch } from "./internal/app-route-detection.js";
import { isAbsoluteOrProtocolRelativeUrl, normalizePathTrailingSlash, toBrowserNavigationHref, toSameOriginAppPath, withBasePath } from "./url-utils.js";
import { appendSearchParamsToUrl, urlQueryToSearchParams } from "../utils/query.js";
import { interpolateDynamicRouteHref } from "./internal/interpolate-as.js";
import { getCurrentBrowserLocale } from "./client-locale.js";
import { getCurrentRoutePathnameForWarning } from "./internal/route-pattern-for-warning.js";
import { isBotUserAgent } from "../utils/html-limited-bots.js";
import { getNavigationRuntime, hasAppNavigationRuntime, registerNavigationRuntimeFunctions } from "../client/navigation-runtime.js";
import { navigatePagesRouterLinkWithFallback, resolvePagesRouterQueryOnlyHref } from "../client/pages-router-link-navigation.js";
import { scheduleAppPrefetchFetch } from "./internal/app-prefetch-fetch-queue.js";
import { getI18nContext } from "./i18n-context.js";
import { canLinkIntentPrefetch, canLinkPrefetch, getLinkPrefetchHref } from "./link-prefetch.js";
import { clearLinkForCurrentNavigation, notifyLinkNavigationStart, setLinkForCurrentNavigation } from "./internal/link-status-registry.js";
import React, { createContext, forwardRef, useCallback, useContext, useEffect, useRef, useState } from "react";
import { jsx } from "react/jsx-runtime";
//#region src/shims/link.tsx
/**
* next/link shim
*
* Renders an <a> tag with client-side navigation support.
* On click, prevents full page reload and triggers client-side
* page swap via the router's navigation system.
*/
const HAS_PAGES_ROUTER = process.env.__VINEXT_HAS_PAGES_ROUTER !== "false";
const HAS_CLIENT_REWRITES = process.env.__VINEXT_HAS_CLIENT_REWRITES !== "false";
const LinkStatusContext = createContext({ pending: false });
/**
* useLinkStatus returns the pending state of the enclosing <Link>.
* In Next.js, this is used to show loading indicators while a
* prefetch-triggered navigation is in progress.
*/
function useLinkStatus() {
	return useContext(LinkStatusContext);
}
let linkPrefetchNavigationEpoch = 0;
function notifyLinkNavigationStartAndCancelPrefetchSetup() {
	linkPrefetchNavigationEpoch += 1;
	notifyLinkNavigationStart();
}
if (typeof window !== "undefined") registerNavigationRuntimeFunctions({ notifyLinkNavigationStart: notifyLinkNavigationStartAndCancelPrefetchSetup });
/** basePath from next.config.js, injected by the plugin at build time */
const __basePath = process.env.__NEXT_ROUTER_BASEPATH ?? "";
/** trailingSlash from next.config.js, injected by the plugin at build time */
const __trailingSlash = process.env.__VINEXT_TRAILING_SLASH === "true";
const __prefetchInlining = process.env.__VINEXT_PREFETCH_INLINING === "true";
const linkPrefetchRouteTrieCache = createRouteTrieCache();
function resolveHref(href) {
	if (typeof href === "string") return href;
	let url = href.pathname ?? "";
	if (href.query) {
		const params = urlQueryToSearchParams(href.query);
		url = appendSearchParamsToUrl(url, params);
	}
	if (href.hash) url += href.hash.startsWith("#") ? href.hash : `#${href.hash}`;
	return url;
}
function resolvePagesQueryOnlyHref(href) {
	if (!HAS_PAGES_ROUTER) return href;
	if (!href.startsWith("?") && !href.startsWith("#") || typeof window === "undefined") return href;
	const pagesRouter = window.next?.appDir === true ? void 0 : window.next?.router;
	return resolvePagesRouterQueryOnlyHref(href, {
		asPath: pagesRouter && "reload" in pagesRouter && "asPath" in pagesRouter && typeof pagesRouter.asPath === "string" ? pagesRouter.asPath : void 0,
		basePath: __basePath,
		fallbackHref: window.location.href,
		locales: window.__VINEXT_LOCALES__
	});
}
function resolvePagesLinkNavigationHref(href, locale) {
	return normalizePathTrailingSlash(applyLocaleToHref(resolvePagesQueryOnlyHref(href), locale), __trailingSlash);
}
function applyPagesNavigationFallback(href, replace) {
	if (replace) window.history.replaceState({}, "", href);
	else window.history.pushState({}, "", href);
	window.dispatchEvent(new PopStateEvent("popstate"));
}
/**
* Collapse repeated forward-slashes (and convert backslashes to forward-slashes)
* in the path portion of a URL, preserving any query string.
*
* Ported from Next.js: packages/next/src/shared/lib/utils/normalize-repeated-slashes.ts
* https://github.com/vercel/next.js/blob/canary/packages/next/src/shared/lib/utils/normalize-repeated-slashes.ts
*/
function normalizeRepeatedSlashes(url) {
	const urlParts = url.split("?");
	const urlNoQueryString = urlParts.shift() ?? "";
	const queryString = urlParts.join("?");
	return urlNoQueryString.replace(/\\/g, "/").replace(/\/\/+/g, "/") + (queryString ? `?${queryString}` : "");
}
/**
* Emit Next.js's "Invalid href" `console.error` when `href` contains repeated
* forward slashes or backslashes in its path portion, and return the
* normalized URL (with `\\` converted to `/` and runs of `/` collapsed). If
* the href is already well-formed, the original string is returned unchanged.
*
* Ported from Next.js: packages/next/src/client/resolve-href.ts
* https://github.com/vercel/next.js/blob/canary/packages/next/src/client/resolve-href.ts
*
* Matches the message asserted by:
* test/e2e/repeated-forward-slashes-error/repeated-forward-slashes-error.test.ts
*
* Note: Next.js fires this warning unconditionally on every call to
* `resolveHref`. We mirror that behaviour (no dedup) for exact parity.
*
* Note: Next.js uses `router.pathname` (the route pattern, e.g.
* `/posts/[id]`) for the "in page" segment of the message. The Next.js
* compat test asserts this exact text (`in page: '/my/path/[name]'`), so we
* source it from the current render's route pattern via
* `getCurrentRoutePathnameForWarning()`: the Pages Router SSR context's route
* pattern on the server, `window.location.pathname` on the client, falling
* back to `"/"`.
*/
function warnAndNormalizeRepeatedSlashesInHref(urlAsString) {
	if (urlAsString.startsWith("//")) return urlAsString;
	const urlProtoMatch = urlAsString.match(/^[a-z][a-z0-9+.-]*:\/\//i);
	const urlAsStringNoProto = urlProtoMatch ? urlAsString.slice(urlProtoMatch[0].length) : urlAsString;
	if (!(urlAsStringNoProto.split("?", 1)[0] || "").match(/(\/\/|\\)/)) return urlAsString;
	const pathname = getCurrentRoutePathnameForWarning();
	console.error(`Invalid href '${urlAsString}' passed to next/router in page: '${pathname}'. Repeated forward-slashes (//) or backslashes \\ are not valid in the href.`);
	const normalizedNoProto = normalizeRepeatedSlashes(urlAsStringNoProto);
	return (urlProtoMatch ? urlProtoMatch[0] : "") + normalizedNoProto;
}
function resolveLinkPrefetchMode(prefetchProp, isDangerous) {
	if (isDangerous || prefetchProp === false) return "disabled";
	if (prefetchProp === true) return "full";
	return "auto";
}
function toSameOriginRouteHref(href) {
	if (typeof window === "undefined") return null;
	let url;
	try {
		url = new URL(href, window.location.href);
	} catch {
		return null;
	}
	if (url.origin !== window.location.origin) return null;
	return `${stripBasePath(url.pathname, __basePath)}${url.search}`;
}
function getLinkPrefetchRouterMode() {
	return hasAppNavigationRuntime() ? "app" : "pages";
}
function resolveMatchedAutoAppRoutePrefetch(route) {
	return {
		cacheForNavigation: !route.canPrefetchLoadingShell && route.requiresDynamicNavigationRequest !== true,
		prefetchShellFirst: !route.isDynamic,
		shouldPrefetch: true
	};
}
function canAutoPrefetchFullAppRoute(href) {
	if (typeof window === "undefined") return false;
	const routes = window.__VINEXT_LINK_PREFETCH_ROUTES__;
	if (!routes) return false;
	const routeHref = toSameOriginRouteHref(href);
	if (routeHref === null) return false;
	if (!matchRouteWithTrie(routeHref, routes, linkPrefetchRouteTrieCache)) return false;
	return resolveAutoAppRoutePrefetch(href).cacheForNavigation;
}
function resolveAutoAppRoutePrefetch(href) {
	if (typeof window === "undefined") return {
		cacheForNavigation: false,
		prefetchShellFirst: false,
		shouldPrefetch: false
	};
	const routes = window.__VINEXT_LINK_PREFETCH_ROUTES__;
	if (!routes) return {
		cacheForNavigation: false,
		prefetchShellFirst: false,
		shouldPrefetch: false
	};
	const routeHref = toSameOriginRouteHref(href);
	if (routeHref === null) return {
		cacheForNavigation: false,
		prefetchShellFirst: false,
		shouldPrefetch: false
	};
	const match = matchRouteWithTrie(routeHref, routes, linkPrefetchRouteTrieCache);
	if (!match) return {
		cacheForNavigation: false,
		prefetchShellFirst: false,
		shouldPrefetch: false
	};
	const prefetch = resolveMatchedAutoAppRoutePrefetch(match.route);
	if (new URL(routeHref, "http://vinext.local").search !== "") return {
		...prefetch,
		cacheForNavigation: false,
		prefetchShellFirst: true
	};
	return prefetch;
}
function resolveFullAppRoutePrefetch() {
	return {
		cacheForNavigation: true,
		prefetchShellFirst: true,
		shouldPrefetch: true
	};
}
/**
* Prefetch a URL for faster navigation.
*
* For App Router (RSC): fetches the .rsc payload in the background and
* stores it in an in-memory cache for instant use during navigation.
* For Pages Router: warms the page chunk, prefetches data only for SSG pages,
* and falls back to a document prefetch hint when no page loader matches.
*
* App Router and high-priority prefetches start immediately. Low-priority
* Pages Router fallback prefetches use `requestIdleCallback` (or `setTimeout`
* fallback) to avoid blocking the main thread during initial page load.
*/
function prefetchUrl(href, mode, priority = "low", pagesRouteHref, locale) {
	if (typeof window === "undefined") return;
	const navigationEpoch = linkPrefetchNavigationEpoch;
	const prefetchHref = getLinkPrefetchHref({
		href,
		basePath: __basePath,
		currentOrigin: window.location.origin
	});
	if (prefetchHref == null) return;
	const fullHref = toBrowserNavigationHref(prefetchHref, window.location.href, __basePath);
	const fullRouteHref = toBrowserNavigationHref(pagesRouteHref === void 0 ? prefetchHref : getLinkPrefetchHref({
		href: pagesRouteHref,
		basePath: __basePath,
		currentOrigin: window.location.origin
	}) ?? prefetchHref, window.location.href, __basePath);
	const target = new URL(fullHref, window.location.href);
	if (target.origin === window.location.origin && target.pathname === window.location.pathname && target.search === window.location.search) return;
	const runPrefetch = () => {
		(async () => {
			if (hasAppNavigationRuntime()) {
				if (isBotUserAgent(window.navigator?.userAgent ?? "")) return;
				const [navigation, { AppElementsWire }, rscCacheBusting, { APP_RSC_RENDER_MODE_PREFETCH_DYNAMIC_SHELL, APP_RSC_RENDER_MODE_PREFETCH_LOADING_SHELL }, headersModule, hybridRouteOwner] = await Promise.all([
					import("./navigation.js"),
					import("../server/app-elements.js"),
					import("../server/app-rsc-cache-busting.js"),
					import("../server/app-rsc-render-mode.js"),
					import("../server/headers.js"),
					HAS_PAGES_ROUTER || HAS_CLIENT_REWRITES ? import("./internal/hybrid-client-route-owner.js") : null
				]);
				if (navigationEpoch !== linkPrefetchNavigationEpoch) return;
				const { getPrefetchInterceptionContext, getPrefetchCache, getPrefetchedUrls, getMountedSlotsHeader, hasSearchAgnosticPrefetchShellForRoute, hasPrefetchCacheEntryForNavigation, peekPrefetchResponseForNavigation, prefetchRscResponse, restoreRscResponse, PREFETCH_CACHE_TTL } = navigation;
				const { createRscRequestHeaders, createRscRequestUrl } = rscCacheBusting;
				const { NEXT_ROUTER_PREFETCH_HEADER, NEXT_ROUTER_SEGMENT_PREFETCH_HEADER, VINEXT_MOUNTED_SLOTS_HEADER } = headersModule;
				const hybridOwner = HAS_PAGES_ROUTER ? hybridRouteOwner.resolveHybridClientRouteOwner(prefetchHref, __basePath) : null;
				if (hybridOwner === "pages" || hybridOwner === "document") return;
				const rewrittenPrefetchHref = HAS_CLIENT_REWRITES ? hybridRouteOwner.resolveHybridClientRewriteHref(fullHref, __basePath) : null;
				const autoPrefetch = mode === "auto" ? resolveAutoAppRoutePrefetch(rewrittenPrefetchHref ?? prefetchHref) : mode === "full-after-shell" ? {
					cacheForNavigation: true,
					prefetchShellFirst: true,
					shouldPrefetch: true
				} : resolveFullAppRoutePrefetch();
				if (!autoPrefetch.shouldPrefetch) return;
				const interceptionContext = getPrefetchInterceptionContext(fullHref);
				const mountedSlotsHeader = getMountedSlotsHeader();
				const isOptimisticRouteShellPrefetch = !autoPrefetch.cacheForNavigation;
				const hasSearchParams = new URL(fullHref, window.location.href).search !== "";
				const isAutomaticSearchParamShell = mode === "auto" && isOptimisticRouteShellPrefetch && hasSearchParams;
				if (isOptimisticRouteShellPrefetch && interceptionContext !== null) return;
				const hasSearchAgnosticShell = isAutomaticSearchParamShell && hasSearchAgnosticPrefetchShellForRoute(await createRscRequestUrl(fullHref, new Headers()), interceptionContext, mountedSlotsHeader);
				const headers = createRscRequestHeaders({
					interceptionContext,
					renderMode: isOptimisticRouteShellPrefetch ? hasSearchAgnosticShell ? APP_RSC_RENDER_MODE_PREFETCH_LOADING_SHELL : isAutomaticSearchParamShell ? APP_RSC_RENDER_MODE_PREFETCH_DYNAMIC_SHELL : APP_RSC_RENDER_MODE_PREFETCH_LOADING_SHELL : void 0
				});
				if (mountedSlotsHeader) headers.set(VINEXT_MOUNTED_SLOTS_HEADER, mountedSlotsHeader);
				const shouldSendSegmentPrefetchHeaders = isOptimisticRouteShellPrefetch || mode === "auto";
				if (__prefetchInlining && autoPrefetch.cacheForNavigation) {
					headers.set(NEXT_ROUTER_PREFETCH_HEADER, "1");
					headers.set(NEXT_ROUTER_SEGMENT_PREFETCH_HEADER, "/__PAGE__");
				} else if (shouldSendSegmentPrefetchHeaders) {
					headers.set(NEXT_ROUTER_PREFETCH_HEADER, "1");
					headers.set(NEXT_ROUTER_SEGMENT_PREFETCH_HEADER, "1");
				}
				const rscUrl = await createRscRequestUrl(fullHref, headers);
				const additionalRscUrls = rewrittenPrefetchHref && rewrittenPrefetchHref !== fullHref ? [await createRscRequestUrl(rewrittenPrefetchHref, headers)] : [];
				const cacheKey = AppElementsWire.encodeCacheKey(rscUrl, interceptionContext);
				const prefetched = getPrefetchedUrls();
				if (prefetched.has(cacheKey)) {
					if (!autoPrefetch.cacheForNavigation) return;
					const existing = getPrefetchCache().get(cacheKey);
					if (existing?.cacheForNavigation === false) existing.cacheForNavigation = true;
				}
				const fetchFullRscPayload = () => scheduleAppPrefetchFetch(() => fetch(rscUrl, {
					headers,
					credentials: "include",
					priority,
					purpose: "prefetch"
				}), priority);
				const fetchLoadingShellForReuse = async () => {
					const shellHeaders = createRscRequestHeaders({
						interceptionContext,
						renderMode: APP_RSC_RENDER_MODE_PREFETCH_LOADING_SHELL
					});
					shellHeaders.set(NEXT_ROUTER_PREFETCH_HEADER, "1");
					shellHeaders.set(NEXT_ROUTER_SEGMENT_PREFETCH_HEADER, "1");
					if (mountedSlotsHeader) shellHeaders.set(VINEXT_MOUNTED_SLOTS_HEADER, mountedSlotsHeader);
					const shellRscUrl = await createRscRequestUrl(fullHref, shellHeaders);
					const shellCacheKey = AppElementsWire.encodeCacheKey(shellRscUrl, interceptionContext);
					const shellCache = getPrefetchCache();
					let shellEntry = shellCache.get(shellCacheKey);
					if (shellEntry === void 0) {
						getPrefetchedUrls().add(shellCacheKey);
						prefetchRscResponse(shellRscUrl, scheduleAppPrefetchFetch(() => fetch(shellRscUrl, {
							headers: shellHeaders,
							credentials: "include",
							priority,
							purpose: "prefetch"
						}), priority), interceptionContext, mountedSlotsHeader, void 0, {
							cacheForNavigation: false,
							optimisticRouteShell: true,
							prefetchKind: "loading-shell"
						});
						shellEntry = shellCache.get(shellCacheKey);
					}
					await shellEntry?.pending?.catch(() => {});
				};
				const fetchAliasCacheHitProbe = async () => {
					const probeHeaders = createRscRequestHeaders({
						interceptionContext,
						renderMode: APP_RSC_RENDER_MODE_PREFETCH_LOADING_SHELL
					});
					probeHeaders.set(NEXT_ROUTER_PREFETCH_HEADER, "1");
					probeHeaders.set(NEXT_ROUTER_SEGMENT_PREFETCH_HEADER, "1");
					if (mountedSlotsHeader) probeHeaders.set(VINEXT_MOUNTED_SLOTS_HEADER, mountedSlotsHeader);
					const probeRscUrl = await createRscRequestUrl(fullHref, probeHeaders);
					return fetch(probeRscUrl, {
						method: "HEAD",
						headers: probeHeaders,
						credentials: "include",
						priority,
						purpose: "prefetch"
					});
				};
				const hasExactNavigationCacheEntry = autoPrefetch.cacheForNavigation && hasPrefetchCacheEntryForNavigation(rscUrl, interceptionContext, mountedSlotsHeader);
				if (hasExactNavigationCacheEntry || autoPrefetch.cacheForNavigation && hasPrefetchCacheEntryForNavigation(rscUrl, interceptionContext, mountedSlotsHeader, { additionalRscUrls })) {
					if (!hasExactNavigationCacheEntry && !prefetched.has(cacheKey) && additionalRscUrls.length > 0 && autoPrefetch.prefetchShellFirst && mountedSlotsHeader === null) {
						prefetched.add(cacheKey);
						fetchAliasCacheHitProbe().then((response) => response.arrayBuffer()).catch(() => {});
					}
					return;
				}
				prefetched.add(cacheKey);
				const gateViaRouteTree = __prefetchInlining && mode === "auto" && autoPrefetch.prefetchShellFirst;
				const gateViaExplicitSearchShell = mode === "full" && hasSearchParams && autoPrefetch.prefetchShellFirst && mountedSlotsHeader === null;
				const gateViaLoadingShell = (mode === "full-after-shell" || gateViaExplicitSearchShell) && autoPrefetch.prefetchShellFirst;
				const fetchPromise = autoPrefetch.cacheForNavigation && (gateViaRouteTree || gateViaLoadingShell) ? (async () => {
					if (gateViaLoadingShell) {
						await fetchLoadingShellForReuse();
						return fetchFullRscPayload();
					}
					const shellHeaders = createRscRequestHeaders({
						interceptionContext,
						renderMode: void 0
					});
					shellHeaders.set(NEXT_ROUTER_PREFETCH_HEADER, "1");
					shellHeaders.set(NEXT_ROUTER_SEGMENT_PREFETCH_HEADER, "/_tree");
					if (mountedSlotsHeader) shellHeaders.set(VINEXT_MOUNTED_SLOTS_HEADER, mountedSlotsHeader);
					const shellRscUrl = await createRscRequestUrl(fullHref, shellHeaders);
					const shellCacheKey = AppElementsWire.encodeCacheKey(shellRscUrl, interceptionContext);
					const shellCache = getPrefetchCache();
					let shellEntry = shellCache.get(shellCacheKey);
					if (shellEntry === void 0) {
						getPrefetchedUrls().add(shellCacheKey);
						prefetchRscResponse(shellRscUrl, scheduleAppPrefetchFetch(() => fetch(shellRscUrl, {
							headers: shellHeaders,
							credentials: "include",
							priority,
							purpose: "prefetch"
						}), priority), interceptionContext, mountedSlotsHeader, void 0, {
							cacheForNavigation: false,
							optimisticRouteShell: false,
							prefetchKind: "route-tree"
						});
						shellEntry = shellCache.get(shellCacheKey);
					}
					await shellEntry?.pending?.catch(() => {});
					const renderedPathAndSearch = shellEntry?.snapshot?.renderedPathAndSearch;
					if (renderedPathAndSearch) {
						const renderedRscUrl = await createRscRequestUrl(renderedPathAndSearch, headers);
						const cachedRenderedResponse = peekPrefetchResponseForNavigation(renderedRscUrl, interceptionContext, mountedSlotsHeader);
						if (cachedRenderedResponse) return restoreRscResponse(cachedRenderedResponse);
					}
					return scheduleAppPrefetchFetch(() => fetch(rscUrl, {
						headers,
						credentials: "include",
						priority,
						purpose: "prefetch"
					}), priority);
				})() : fetchFullRscPayload();
				if (mode === "full" && autoPrefetch.cacheForNavigation && autoPrefetch.prefetchShellFirst && mountedSlotsHeader === null && !gateViaExplicitSearchShell) fetchLoadingShellForReuse();
				prefetchRscResponse(rscUrl, fetchPromise, interceptionContext, mountedSlotsHeader, void 0, {
					cacheForNavigation: autoPrefetch.cacheForNavigation,
					fallbackTtlMs: PREFETCH_CACHE_TTL,
					optimisticRouteShell: isOptimisticRouteShellPrefetch,
					prefetchKind: isOptimisticRouteShellPrefetch ? "loading-shell" : "navigation",
					searchAgnosticShell: isAutomaticSearchParamShell && !hasSearchAgnosticShell
				});
			} else if (HAS_PAGES_ROUTER && window.__NEXT_DATA__) {
				const dataTarget = resolvePagesDataNavigationTarget(fullRouteHref, __basePath, { locale });
				if (dataTarget) {
					const middlewareDataHref = fullRouteHref === fullHref ? dataTarget.middlewareDataHref : getPagesMiddlewareDataHref(fullHref, __basePath) ?? void 0;
					prefetchPagesData({
						...dataTarget,
						middlewareDataHref
					});
				} else {
					await markAppRouteDetectedOnPrefetch(fullHref, __basePath);
					const link = document.createElement("link");
					link.rel = "prefetch";
					link.href = fullHref;
					link.as = "document";
					document.head.appendChild(link);
				}
			}
		})().catch((error) => {
			console.error("[vinext] RSC prefetch setup error:", error);
		});
	};
	if (priority === "high" || hasAppNavigationRuntime()) {
		runPrefetch();
		return;
	}
	(window.requestIdleCallback ?? ((fn) => setTimeout(fn, 100)))(runPrefetch);
}
async function promotePrefetchEntriesForNavigation(href) {
	if (typeof window === "undefined") return;
	if (!hasAppNavigationRuntime()) return;
	const [{ getPrefetchCache }, { stripRscCacheBustingSearchParam, stripRscSuffix }] = await Promise.all([import("./navigation.js"), import("../server/app-rsc-cache-busting.js")]);
	let target;
	try {
		target = new URL(toBrowserNavigationHref(href, window.location.href, __basePath), window.location.href);
	} catch {
		return;
	}
	for (const [cacheKey, entry] of getPrefetchCache()) {
		if (entry.optimisticRouteShell === true) continue;
		if (entry.prefetchKind === "route-tree") continue;
		const [rscUrl] = cacheKey.split("\0", 1);
		let cached;
		try {
			cached = new URL(rscUrl, window.location.href);
		} catch {
			continue;
		}
		stripRscCacheBustingSearchParam(cached);
		if (stripRscSuffix(cached.pathname) === target.pathname && cached.search === target.search) entry.cacheForNavigation = true;
	}
}
/**
* Shared IntersectionObserver for viewport-based prefetching.
* All Link elements use the same observer to minimize resource usage.
*/
let sharedObserver = null;
const observedLinkPrefetches = /* @__PURE__ */ new WeakMap();
const visibleLinkPrefetches = /* @__PURE__ */ new Set();
const visibleAppPrefetchQueue = [];
let visibleAppPrefetchDrainScheduled = false;
function drainVisibleAppPrefetchQueue() {
	visibleAppPrefetchDrainScheduled = false;
	while (true) {
		const instance = visibleAppPrefetchQueue.pop();
		if (!instance) return;
		instance.queuedViewportPrefetch = false;
		if (!instance.isVisible || instance.routerMode !== "app") continue;
		prefetchUrl(instance.href, instance.mode, "low", instance.pagesRouteHref);
	}
}
function scheduleVisibleAppPrefetch(instance) {
	if (instance.queuedViewportPrefetch) return;
	instance.queuedViewportPrefetch = true;
	visibleAppPrefetchQueue.push(instance);
	if (visibleAppPrefetchDrainScheduled) return;
	visibleAppPrefetchDrainScheduled = true;
	queueMicrotask(drainVisibleAppPrefetchQueue);
}
function setVisibleLinkPrefetch(instance, isVisible) {
	instance.isVisible = isVisible;
	if (isVisible) {
		visibleLinkPrefetches.add(instance);
		if (instance.routerMode === "pages" && instance.viewportPrefetched) return;
		if (instance.routerMode === "app") scheduleVisibleAppPrefetch(instance);
		else prefetchUrl(instance.href, instance.mode, "low", instance.pagesRouteHref, instance.locale);
		instance.viewportPrefetched = true;
	} else visibleLinkPrefetches.delete(instance);
}
function registerVisibleLinkPing() {
	if (typeof window === "undefined") return;
	registerNavigationRuntimeFunctions({ pingVisibleLinks: pingVisibleLinkPrefetches });
}
function pingVisibleLinkPrefetches() {
	for (const instance of visibleLinkPrefetches) if (instance.isVisible && instance.routerMode === "app") scheduleVisibleAppPrefetch(instance);
}
function getSharedObserver() {
	if (typeof window === "undefined" || typeof IntersectionObserver === "undefined") return null;
	if (sharedObserver) return sharedObserver;
	sharedObserver = new IntersectionObserver((entries) => {
		for (const entry of entries) {
			const instance = observedLinkPrefetches.get(entry.target);
			if (!instance) continue;
			setVisibleLinkPrefetch(instance, entry.isIntersecting || entry.intersectionRatio > 0);
		}
	}, { rootMargin: "250px" });
	return sharedObserver;
}
function getDefaultLocale() {
	if (typeof window !== "undefined") return window.__VINEXT_DEFAULT_LOCALE__;
	return getI18nContext()?.defaultLocale;
}
function getCurrentLocale() {
	if (typeof window !== "undefined") return getCurrentBrowserLocale({
		basePath: __basePath,
		domainLocales: getDomainLocales(),
		hostname: getCurrentHostname()
	});
	return getI18nContext()?.locale;
}
function getDomainLocales() {
	if (typeof window !== "undefined") return window.__NEXT_DATA__?.domainLocales;
	return getI18nContext()?.domainLocales;
}
function getCurrentHostname() {
	if (typeof window !== "undefined") return window.location.hostname;
	return getI18nContext()?.hostname;
}
function getDomainLocaleHref(href, locale) {
	return getDomainLocaleUrl(href, locale, {
		basePath: __basePath,
		currentHostname: getCurrentHostname(),
		domainItems: getDomainLocales()
	});
}
function addLocalePrefixForRoot(href, locale) {
	if (href !== "/" && !href.startsWith("/?") && !href.startsWith("/#")) return;
	let parsed;
	try {
		parsed = new URL(href, "http://vinext.local");
	} catch {
		return;
	}
	if (parsed.origin !== "http://vinext.local" || parsed.pathname !== "/") return;
	return `/${locale}${parsed.search}${parsed.hash}`;
}
/**
* Apply locale prefix to a URL path based on the locale prop.
* - locale="fr" → prepend /fr (unless it already has a locale prefix)
* - locale={false} → use the href as-is (no locale prefix, link to default)
* - locale=undefined → use current locale (href as-is in most cases)
*/
function applyLocaleToHref(href, locale) {
	if (locale === false) return href;
	const resolvedLocale = locale ?? getCurrentLocale();
	if (resolvedLocale === void 0) return href;
	if (isAbsoluteOrProtocolRelativeUrl(href)) return href;
	const domainLocaleHref = getDomainLocaleHref(href, resolvedLocale);
	if (domainLocaleHref) return domainLocaleHref;
	const defaultLocale = getDefaultLocale() ?? "";
	if (resolvedLocale.toLowerCase() === defaultLocale.toLowerCase()) {
		const localeRootHref = addLocalePrefixForRoot(href, resolvedLocale);
		if (localeRootHref) return localeRootHref;
	}
	return addLocalePrefix(href, resolvedLocale, defaultLocale);
}
/**
* For the `<Link href="/blog/[slug]" as="/blog/test-post">` case, project the
* bracket-pattern href + the resolved `as` back into a concrete route URL the
* Pages Router can fetch (`/blog/test-post`). Returns null when:
*   - `href` has no bracket params (already concrete; the existing forwarding
*     path works as-is)
*   - interpolation fails because a required param could not be resolved
*     (caller falls back to `as`, matching pre-PR behavior)
*
* The query for interpolation is the href's own query — `as` is the matcher
* input rather than the source of param values. For string hrefs the search
* portion is parsed into the query record; for object hrefs we take
* `href.query` directly.
*/
function resolveConcreteRouteHref(href, as) {
	if (typeof as !== "string") return null;
	return interpolateDynamicRouteHref(typeof href === "string" ? href : resolveHref(href), as, typeof href === "string" || !href.query || typeof href.query === "string" ? void 0 : href.query)?.href || null;
}
const Link = forwardRef(function Link({ href, as, replace = false, prefetch: prefetchProp, scroll = true, shallow = false, children: childrenProp, onClick, onMouseEnter, onTouchStart, onNavigate, unstable_dynamicOnHover = false, legacyBehavior = false, passHref = false, transitionTypes: _transitionTypes, ...rest }, forwardedRef) {
	const asHref = as === void 0 ? void 0 : resolveHref(as);
	const { locale, ...restWithoutLocale } = rest;
	let children = childrenProp;
	if (legacyBehavior && (typeof childrenProp === "string" || typeof childrenProp === "number")) children = React.createElement("a", null, childrenProp);
	const unresolvedHref = asHref ?? resolveHref(href);
	const rawResolvedHref = typeof unresolvedHref === "string" && unresolvedHref.startsWith("#") ? resolvePagesQueryOnlyHref(unresolvedHref) : unresolvedHref;
	const routeHrefRaw = (HAS_PAGES_ROUTER ? resolveConcreteRouteHref(href, asHref) : null) ?? (typeof href === "string" ? href : resolveHref(href));
	const resolvedHref = typeof rawResolvedHref === "string" ? warnAndNormalizeRepeatedSlashesInHref(rawResolvedHref) : rawResolvedHref;
	const isDangerous = typeof resolvedHref === "string" && isDangerousScheme(resolvedHref);
	const normalizedHref = normalizePathTrailingSlash(applyLocaleToHref(isDangerous ? "/" : resolvedHref, locale), __trailingSlash);
	const normalizedRouteHref = HAS_PAGES_ROUTER && typeof asHref === "string" && typeof routeHrefRaw === "string" && asHref !== routeHrefRaw ? normalizePathTrailingSlash(applyLocaleToHref(isDangerous ? "/" : routeHrefRaw, locale), __trailingSlash) : normalizedHref;
	const fullHref = normalizePathTrailingSlash(withBasePath(normalizedHref, __basePath), __trailingSlash);
	const [pending, setPending] = useState(false);
	const mountedRef = useRef(true);
	const setPendingRef = useRef(null);
	if (setPendingRef.current === null) setPendingRef.current = (next) => {
		if (mountedRef.current) setPending(next);
	};
	useEffect(() => {
		mountedRef.current = true;
		const setter = setPendingRef.current;
		return () => {
			mountedRef.current = false;
			if (setter) clearLinkForCurrentNavigation(setter);
		};
	}, []);
	const internalRef = useRef(null);
	const prefetchMode = resolveLinkPrefetchMode(prefetchProp, isDangerous);
	const shouldViewportPrefetch = canLinkPrefetch({
		nodeEnv: process.env.NODE_ENV,
		prefetch: prefetchProp,
		isDangerous
	});
	const setRefs = useCallback((node) => {
		internalRef.current = node;
		if (typeof forwardedRef === "function") forwardedRef(node);
		else if (forwardedRef) forwardedRef.current = node;
	}, [forwardedRef]);
	useEffect(() => {
		if (!shouldViewportPrefetch || typeof window === "undefined") return;
		const node = internalRef.current;
		if (!node) return;
		const hrefToPrefetch = getLinkPrefetchHref({
			href: normalizedHref,
			basePath: __basePath,
			currentOrigin: window.location.origin
		});
		if (hrefToPrefetch == null) return;
		const observer = getSharedObserver();
		if (!observer) return;
		registerVisibleLinkPing();
		const instance = {
			href: hrefToPrefetch,
			isVisible: false,
			locale,
			mode: prefetchMode,
			pagesRouteHref: normalizedRouteHref === normalizedHref ? void 0 : getLinkPrefetchHref({
				href: normalizedRouteHref,
				basePath: __basePath,
				currentOrigin: window.location.origin
			}) ?? void 0,
			queuedViewportPrefetch: false,
			routerMode: getLinkPrefetchRouterMode(),
			viewportPrefetched: false
		};
		observedLinkPrefetches.set(node, instance);
		observer.observe(node);
		return () => {
			observer.unobserve(node);
			observedLinkPrefetches.delete(node);
			visibleLinkPrefetches.delete(instance);
			instance.isVisible = false;
		};
	}, [
		shouldViewportPrefetch,
		prefetchMode,
		normalizedHref,
		normalizedRouteHref,
		locale
	]);
	const prefetchOnIntent = useCallback(() => {
		if (!canLinkIntentPrefetch({
			nodeEnv: process.env.NODE_ENV,
			prefetch: prefetchProp,
			isDangerous,
			routerMode: getLinkPrefetchRouterMode()
		})) return;
		const intentMode = unstable_dynamicOnHover ? "full-after-shell" : prefetchMode;
		if (unstable_dynamicOnHover && internalRef.current) {
			const instance = observedLinkPrefetches.get(internalRef.current);
			if (instance) instance.mode = "full-after-shell";
			promotePrefetchEntriesForNavigation(normalizedHref);
		}
		prefetchUrl(normalizedHref, intentMode, "high", normalizedRouteHref === normalizedHref ? void 0 : normalizedRouteHref, locale);
	}, [
		prefetchProp,
		isDangerous,
		prefetchMode,
		normalizedHref,
		normalizedRouteHref,
		locale,
		unstable_dynamicOnHover
	]);
	const handleMouseEnter = useCallback((e) => {
		onMouseEnter?.(e);
		prefetchOnIntent();
	}, [onMouseEnter, prefetchOnIntent]);
	const handleTouchStart = useCallback((e) => {
		onTouchStart?.(e);
		prefetchOnIntent();
	}, [onTouchStart, prefetchOnIntent]);
	const handleClick = async (e, options = {}) => {
		if (!options.skipLinkOnClick && onClick) onClick(e);
		if (e.defaultPrevented) return;
		if (e.currentTarget.hasAttribute("download")) return;
		if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
		if (e.currentTarget.target && e.currentTarget.target !== "_self") return;
		let navigateHref = normalizedHref;
		if (isAbsoluteOrProtocolRelativeUrl(resolvedHref)) {
			const localPath = toSameOriginAppPath(resolvedHref, __basePath);
			if (localPath == null) {
				if (replace) {
					e.preventDefault();
					window.location.replace(resolvedHref);
				}
				return;
			}
			navigateHref = localPath;
		}
		e.preventDefault();
		const hasAppNavigationRuntime = Boolean(getNavigationRuntime()?.functions.navigate);
		const pagesNavigateHref = HAS_PAGES_ROUTER && resolvedHref.startsWith("?") ? resolvePagesLinkNavigationHref(resolvedHref, locale) : navigateHref;
		const pagesAsForLink = HAS_PAGES_ROUTER && typeof asHref === "string" && typeof routeHrefRaw === "string" && asHref !== routeHrefRaw ? pagesNavigateHref : void 0;
		const pagesHrefForLink = pagesAsForLink === void 0 ? pagesNavigateHref : routeHrefRaw;
		const absoluteFullHref = toBrowserNavigationHref(hasAppNavigationRuntime ? navigateHref : pagesNavigateHref, window.location.href, __basePath);
		if (onNavigate) try {
			const navUrl = new URL(absoluteFullHref, window.location.origin);
			let prevented = false;
			const navEvent = {
				url: navUrl,
				preventDefault() {
					prevented = true;
				},
				get defaultPrevented() {
					return prevented;
				}
			};
			onNavigate(navEvent);
			if (navEvent.defaultPrevented) return;
		} catch {}
		const hybridOwner = HAS_PAGES_ROUTER && hasAppNavigationRuntime ? (await import("./internal/hybrid-client-route-owner.js")).resolveHybridClientRouteOwner(navigateHref, __basePath) : null;
		if (HAS_PAGES_ROUTER && hasAppNavigationRuntime && ["pages", "document"].includes(hybridOwner ?? "")) {
			if (replace) window.location.replace(absoluteFullHref);
			else window.location.assign(absoluteFullHref);
			return;
		}
		if (hasAppNavigationRuntime) {
			const { navigateClientSide } = await import("./navigation.js");
			const setter = setPendingRef.current;
			if (setter) setLinkForCurrentNavigation(setter);
			setPending(true);
			React.startTransition(() => {
				navigateClientSide(navigateHref, replace ? "replace" : "push", scroll, true).finally(() => {
					if (mountedRef.current) setPending(false);
					if (setter) clearLinkForCurrentNavigation(setter);
				});
			});
			return;
		} else if (HAS_PAGES_ROUTER) {
			const Router = window.next?.appDir === true ? void 0 : window.next?.router;
			await navigatePagesRouterLinkWithFallback({
				router: Router && "reload" in Router ? Router : void 0,
				loadRouter: async () => (await import("next/router")).default,
				navigation: {
					href: pagesHrefForLink,
					as: pagesAsForLink,
					replace,
					scroll,
					shallow,
					locale,
					interpolateDynamicRoute: resolvedHref.startsWith("?")
				},
				fallback: () => applyPagesNavigationFallback(absoluteFullHref, replace)
			});
		} else if (replace) window.location.replace(absoluteFullHref);
		else window.location.assign(absoluteFullHref);
	};
	const anchorProps = restWithoutLocale;
	const linkStatusValue = React.useMemo(() => ({ pending }), [pending]);
	if (isDangerous) {
		if (process.env.NODE_ENV !== "production") console.warn(`<Link> blocked dangerous href: ${resolvedHref}`);
		const handleDangerousClick = (event) => {
			if (onClick) onClick(event);
			reportBlockedDangerousNavigation();
		};
		if (legacyBehavior) {
			const child = React.Children.only(children);
			const childOnClick = child.props.onClick;
			const childRef = child.props.ref;
			const setDangerousRefs = (node) => {
				internalRef.current = node;
				if (typeof childRef === "function") childRef(node);
				else if (childRef) childRef.current = node;
			};
			return /* @__PURE__ */ jsx(LinkStatusContext.Provider, {
				value: linkStatusValue,
				children: React.cloneElement(child, {
					ref: setDangerousRefs,
					onClick: (event) => {
						if (childOnClick) childOnClick(event);
						reportBlockedDangerousNavigation();
					}
				})
			});
		}
		return /* @__PURE__ */ jsx(LinkStatusContext.Provider, {
			value: linkStatusValue,
			children: /* @__PURE__ */ jsx("a", {
				ref: setRefs,
				onClick: handleDangerousClick,
				onMouseEnter: handleMouseEnter,
				onTouchStart: handleTouchStart,
				...anchorProps,
				children
			})
		});
	}
	if (legacyBehavior) {
		const child = React.Children.only(children);
		if (process.env.NODE_ENV !== "production") {
			if (onClick) console.warn(`"onClick" was passed to <Link> with \`href\` of \`${resolveHref(href)}\` but "legacyBehavior" was set. The legacy behavior requires onClick be set on the child of next/link`);
			if (onMouseEnter) console.warn(`"onMouseEnter" was passed to <Link> with \`href\` of \`${resolveHref(href)}\` but "legacyBehavior" was set. The legacy behavior requires onMouseEnter be set on the child of next/link`);
		}
		const childPropsExisting = child.props;
		const childHasOwnHref = child.type === "a" ? "href" in childPropsExisting : false;
		const shouldForwardHref = passHref || child.type === "a" && !childHasOwnHref;
		const childOnClick = childPropsExisting.onClick;
		const childOnMouseEnter = childPropsExisting.onMouseEnter;
		const childOnTouchStart = childPropsExisting.onTouchStart;
		const childRef = childPropsExisting.ref;
		const setLegacyRefs = (node) => {
			internalRef.current = node;
			if (typeof childRef === "function") childRef(node);
			else if (childRef) childRef.current = node;
		};
		const clonedProps = {
			ref: setLegacyRefs,
			onClick: (event) => {
				if (childOnClick) childOnClick(event);
				if (event.defaultPrevented) return;
				return handleClick(event, { skipLinkOnClick: true });
			},
			onMouseEnter: (event) => {
				if (childOnMouseEnter) childOnMouseEnter(event);
				prefetchOnIntent();
			},
			onTouchStart: (event) => {
				if (childOnTouchStart) childOnTouchStart(event);
				prefetchOnIntent();
			}
		};
		if (shouldForwardHref) clonedProps.href = fullHref;
		return /* @__PURE__ */ jsx(LinkStatusContext.Provider, {
			value: linkStatusValue,
			children: React.cloneElement(child, clonedProps)
		});
	}
	return /* @__PURE__ */ jsx(LinkStatusContext.Provider, {
		value: linkStatusValue,
		children: /* @__PURE__ */ jsx("a", {
			ref: setRefs,
			href: fullHref,
			onClick: handleClick,
			onMouseEnter: handleMouseEnter,
			onTouchStart: handleTouchStart,
			...anchorProps,
			children
		})
	});
});
//#endregion
export { canAutoPrefetchFullAppRoute, Link as default, resolveAutoAppRoutePrefetch, resolveLinkPrefetchMode, useLinkStatus };
