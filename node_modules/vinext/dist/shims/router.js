import { splitPathSegments } from "../routing/utils.js";
import { hasBasePath, removeTrailingSlash, stripBasePath } from "../utils/base-path.js";
import { parseCookieHeader } from "../utils/parse-cookie.js";
import { assertSafeNavigationUrl } from "./url-safety.js";
import { isExternalUrl } from "../utils/external-url.js";
import { isUnknownRecord } from "../utils/record.js";
import { AppRouterContext } from "./internal/app-router-context.js";
import { RouterContext } from "./internal/router-context.js";
import { applyVinextLocaleGlobals, extractVinextNextDataJson, parseVinextNextDataJson } from "../client/vinext-next-data.js";
import { isValidModulePath } from "../client/validate-module-path.js";
import { addLocalePrefix, getDomainLocaleUrl, getLocalePathPrefix } from "../utils/domain-locale.js";
import { fillRoutePatternSegments, matchRoutePattern, routePatternParts } from "../routing/route-pattern.js";
import { NEXT_DEPLOYMENT_ID_HEADER, getDeploymentId } from "../utils/deployment-id.js";
import { dedupedPagesDataFetch, evictPagesDataCache, fetchCachedPagesData, fetchStaticPagesData, getPagesStaticDataCache } from "./internal/pages-data-fetch-dedup.js";
import { getPagesMiddlewareDataHref, prefetchPagesData, resolvePagesDataNavigationTarget } from "./internal/pages-data-target.js";
import { getPagesRouterComponentsMap } from "./internal/pages-router-components.js";
import { markAppRouteDetectedOnPrefetch } from "./internal/app-route-detection.js";
import { resolveDirectHybridClientRouteOwner } from "./internal/hybrid-client-route-owner-direct.js";
import { installWindowNext } from "../client/window-next.js";
import { getWindowOrigin, isAbsoluteOrProtocolRelativeUrl, isHashOnlyBrowserUrlChange, normalizePathTrailingSlash, toBrowserNavigationHref, toSameOriginAppPath, withBasePath } from "./url-utils.js";
import { addQueryParam, appendSearchParamsToUrl, mergeRewriteQuery, mergeRouteParamsIntoQuery, parseQueryString, urlQueryToSearchParams } from "../utils/query.js";
import { scrollToHashTarget } from "./hash-scroll.js";
import { installPagesRouterRuntime, setPagesRouterPopStateHandler, setStampInitialHistoryState } from "./pages-router-runtime.js";
import { interpolateDynamicRouteHref } from "./internal/interpolate-as.js";
import { getCurrentBrowserLocale } from "./client-locale.js";
import { Component, Fragment, StrictMode, createElement, useContext, useEffect, useLayoutEffect, useMemo, useState } from "react";
//#region src/shims/router.ts
/**
* next/router shim
*
* Provides useRouter() hook and Router singleton for Pages Router.
* Backed by the browser History API. Supports client-side navigation
* by fetching new page data and re-rendering the React root.
*/
/** basePath from next.config.js, injected by the plugin at build time */
const __basePath = process.env.__NEXT_ROUTER_BASEPATH ?? "";
/** trailingSlash from next.config.js, injected by the plugin at build time */
const __trailingSlash = process.env.__VINEXT_TRAILING_SLASH === "true";
/** experimental.scrollRestoration from next.config.js, injected by the plugin at build time */
const __scrollRestoration = process.env.__NEXT_SCROLL_RESTORATION === "true";
const noopCommit = () => {};
const SCROLL_RESTORE_MAX_FRAMES = 60;
const SCROLL_RESTORE_TOLERANCE_PX = 1;
/**
* A version of useLayoutEffect that doesn't warn during SSR.
* `wrapWithRouterContext` is shared with the server-side Pages Router render
* path, where a raw useLayoutEffect would log React's "useLayoutEffect does
* nothing on the server" warning on every render. Same pattern as
* `shims/image.tsx`; Next.js only runs the commit callback on the client.
*/
const useNonWarningLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;
var PagesRouterCommitBoundary = class extends Component {
	componentDidCatch(error) {
		this.props.onError(error);
	}
	render() {
		return createElement(PagesRouterCommitBoundaryHelper, { onCommit: this.props.onCommit }, this.props.children);
	}
};
function PagesRouterCommitBoundaryHelper({ children, onCommit }) {
	useNonWarningLayoutEffect(() => {
		onCommit();
	}, [onCommit]);
	return createElement(Fragment, null, children);
}
function renderPagesRouterElement(element, scroll) {
	const root = window.__VINEXT_ROOT__;
	if (!root) return Promise.resolve();
	cancelPreviousRenderCommit();
	return new Promise((resolve, reject) => {
		const cancel = () => {
			if (routerRuntimeState.cancelPendingRenderCommit === cancel) routerRuntimeState.cancelPendingRenderCommit = null;
			reject(new NavigationCancelledError("superseded"));
		};
		routerRuntimeState.cancelPendingRenderCommit = cancel;
		const clearIfCurrent = () => {
			if (routerRuntimeState.cancelPendingRenderCommit === cancel) routerRuntimeState.cancelPendingRenderCommit = null;
		};
		const isCurrent = () => routerRuntimeState.cancelPendingRenderCommit === cancel;
		const scrollHandler = async () => {
			if (scroll) await restorePagesRouterScrollPosition(scroll, isCurrent);
		};
		root.render(wrapWithRouterContext(element, () => {
			(async () => {
				if (!isCurrent()) return;
				try {
					await scrollHandler();
					if (!isCurrent()) return;
					clearIfCurrent();
					resolve();
				} catch (err) {
					clearIfCurrent();
					reject(err);
				}
			})();
		}, (error) => {
			clearIfCurrent();
			reject(error);
		}));
		if (!hasBrowserDocument()) {
			clearIfCurrent();
			resolve();
		}
	});
}
function hasBrowserDocument() {
	return typeof document !== "undefined" && document.documentElement !== void 0;
}
async function restorePagesRouterScrollPosition(scroll, shouldContinue) {
	if (!shouldContinue()) return;
	scrollToPagesRouterPosition(scroll);
	if (isAtScrollPosition(scroll)) return;
	let previousScrollPosition = getWindowScrollPosition();
	for (let frame = 0; frame < SCROLL_RESTORE_MAX_FRAMES; frame += 1) {
		await waitForNextAnimationFrame();
		if (!shouldContinue()) return;
		scrollToPagesRouterPosition(scroll);
		if (isAtScrollPosition(scroll)) return;
		const currentScrollPosition = getWindowScrollPosition();
		if (currentScrollPosition.x === previousScrollPosition.x && currentScrollPosition.y === previousScrollPosition.y) break;
		previousScrollPosition = currentScrollPosition;
	}
}
function scrollToPagesRouterPosition({ x, y }) {
	if (!hasBrowserDocument()) {
		window.scrollTo(x, y);
		return;
	}
	const htmlElement = document.documentElement;
	if (!(htmlElement.dataset.scrollBehavior === "smooth")) {
		window.scrollTo(x, y);
		return;
	}
	const previousScrollBehavior = htmlElement.style.scrollBehavior;
	htmlElement.style.scrollBehavior = "auto";
	htmlElement.getClientRects();
	window.scrollTo(x, y);
	htmlElement.style.scrollBehavior = previousScrollBehavior;
}
function isAtScrollPosition({ x, y }) {
	return Math.abs(window.scrollX - x) <= SCROLL_RESTORE_TOLERANCE_PX && Math.abs(window.scrollY - y) <= SCROLL_RESTORE_TOLERANCE_PX;
}
function waitForNextAnimationFrame() {
	return new Promise((resolve) => {
		if (typeof requestAnimationFrame === "function") {
			requestAnimationFrame(() => resolve());
			return;
		}
		setTimeout(resolve, 16);
	});
}
function canUseSessionStorageForScrollRestoration() {
	if (typeof window === "undefined") return false;
	try {
		const key = "__next";
		window.sessionStorage.setItem(key, key);
		window.sessionStorage.removeItem(key);
		return true;
	} catch {
		return false;
	}
}
const manualScrollRestoration = __scrollRestoration && typeof window !== "undefined" && window.next?.appDir !== true && "scrollRestoration" in window.history && canUseSessionStorageForScrollRestoration();
function installManualScrollRestoration() {
	if (manualScrollRestoration) window.history.scrollRestoration = "manual";
}
function createRouterEvents() {
	const listeners = /* @__PURE__ */ new Map();
	return {
		on(event, handler) {
			if (!listeners.has(event)) listeners.set(event, /* @__PURE__ */ new Set());
			listeners.get(event).add(handler);
		},
		off(event, handler) {
			listeners.get(event)?.delete(handler);
		},
		emit(event, ...args) {
			listeners.get(event)?.forEach((handler) => handler(...args));
		}
	};
}
const PAGES_ROUTER_RUNTIME_STATE_KEY = Symbol.for("vinext.pagesRouter.runtimeState");
function createPagesRouterRuntimeState() {
	return {
		events: createRouterEvents(),
		historyKeyCounter: 0,
		navigationId: 0,
		activeAbortController: null,
		cancelPendingRenderCommit: null,
		lastPathnameAndSearch: typeof window !== "undefined" ? window.location.pathname + window.location.search : "",
		lastHash: typeof window !== "undefined" ? window.location.hash : "",
		isFirstPopStateEvent: true,
		routerDidNavigate: false,
		deprecatedEventBridgeInstalled: false,
		pagesRouterReady: typeof window === "undefined" || !shouldDeferInitialPagesRouterReady()
	};
}
function getPagesRouterRuntimeState() {
	if (typeof window === "undefined") return createPagesRouterRuntimeState();
	const globalObject = window;
	const existing = globalObject[PAGES_ROUTER_RUNTIME_STATE_KEY];
	if (existing) return existing;
	const state = createPagesRouterRuntimeState();
	globalObject[PAGES_ROUTER_RUNTIME_STATE_KEY] = state;
	return state;
}
const routerRuntimeState = getPagesRouterRuntimeState();
const routerEvents = routerRuntimeState.events;
function getPagesRouterRuntimeComponents() {
	const existing = routerRuntimeState.components;
	if (existing) return existing;
	const components = {
		CommitBoundary: PagesRouterCommitBoundary,
		Provider: PagesRouterProvider
	};
	routerRuntimeState.components = components;
	return components;
}
function resolveUrl(url) {
	if (typeof url === "string") return url;
	const query = url.query && typeof url.query === "object" ? url.query : void 0;
	const hasQuery = query !== void 0 && Object.keys(query).length > 0;
	const hasSearch = typeof url.search === "string" && url.search.length > 0;
	const hasHash = typeof url.hash === "string" && url.hash.length > 0;
	const inheritsVisiblePath = url.pathname === void 0 && (hasQuery || hasSearch || hasHash);
	let result = url.pathname ?? (typeof window !== "undefined" ? inheritsVisiblePath ? stripBasePath(window.location.pathname, __basePath) : window.__NEXT_DATA__?.page ?? stripBasePath(window.location.pathname, __basePath) : "/");
	if (hasSearch) {
		const search = url.search.startsWith("?") ? url.search : `?${url.search}`;
		const hashIndex = search.indexOf("#");
		result += hashIndex === -1 ? search : `${search.slice(0, hashIndex)}%23${search.slice(hashIndex + 1)}`;
	} else if (hasQuery) {
		const params = urlQueryToSearchParams(query);
		result = appendSearchParamsToUrl(result, params);
	} else if (hasHash && typeof window !== "undefined") result += window.location.search;
	if (hasHash) result += url.hash.startsWith("#") ? url.hash : `#${url.hash}`;
	return result;
}
/**
* When `as` is provided, use it as the navigation target. This is a
* simplification: Next.js keeps `url` and `as` as separate values (url for
* data fetching, as for the browser URL). We collapse them because vinext's
* navigateClient() fetches HTML from the target URL, so `as` must be a
* server-resolvable path. Purely decorative `as` values are not supported.
* Pages error routes are handled as a narrow exception below because Next.js
* treats their href as the component route while preserving `as` in history.
*/
function resolveNavigationTarget(url, as, locale, replaceExistingLocale = false) {
	return applyNavigationLocale(as ?? resolveUrl(url), locale, replaceExistingLocale);
}
/**
* Next.js's internal `_h` replacement receives browser-visible URLs, which may
* already contain basePath and a locale prefix. Convert those back to app
* paths before the normal history/data URL builders run; otherwise basePath is
* added twice and locale-domain routing can turn a same-document hydration
* update into an external navigation.
*/
function normalizeHydrationNavigationUrl(url) {
	try {
		const parsed = new URL(url, window.location.href);
		const origin = getWindowOrigin();
		if (!origin || parsed.origin !== origin) return url;
		return stripBasePath(parsed.pathname, __basePath) + parsed.search + parsed.hash;
	} catch {
		return url;
	}
}
var HrefInterpolationError = class extends Error {};
function interpolateCurrentDynamicRoute(resolved) {
	if (typeof window === "undefined") return resolved;
	const routePattern = window.__NEXT_DATA__?.page;
	if (!routePattern || extractRouteParamNames(routePattern).length === 0) return resolved;
	try {
		const target = new URL(resolved, "http://vinext.local");
		const currentOrigin = getWindowOrigin();
		if (currentOrigin && target.origin !== "http://vinext.local" && target.origin !== currentOrigin) return resolved;
		const visiblePath = stripBasePath(window.location.pathname, __basePath);
		const visibleLocale = getLocalePathPrefix(visiblePath, window.__VINEXT_LOCALES__);
		if (extractRouteParamsFromPath(routePattern, visibleLocale ? visiblePath.slice(visibleLocale.length + 1) || "/" : visiblePath) === null) return resolved;
		const query = parseQueryString(target.search);
		const missingParams = routePatternParts(routePattern).filter((part) => part.startsWith(":") && !part.endsWith("*")).map((part) => part.slice(1, part.endsWith("+") ? -1 : void 0)).filter((paramName) => {
			const value = query[paramName];
			return value === void 0 || value === "" || Array.isArray(value) && value.length === 0;
		});
		if (missingParams.length > 0) throw new HrefInterpolationError(`The provided \`href\` (${`${routePattern}${target.search}${target.hash}`}) value is missing query values (${missingParams.join(", ")}) to be interpolated properly. Read more: https://nextjs.org/docs/messages/href-interpolation-failed`);
		const routeParams = getRouteParamsFromQuery(routePattern, query);
		if (!routeParams) return resolved;
		const pathname = fillRoutePatternSegments(routePattern, Object.fromEntries(Object.entries(routeParams).map(([key, value]) => [key, Array.isArray(value) ? value.map(encodeURIComponent) : encodeURIComponent(value)])));
		if (!pathname) return resolved;
		const targetLocale = getLocalePathPrefix(target.pathname, window.__VINEXT_LOCALES__);
		target.pathname = targetLocale ? `/${targetLocale}${pathname}` : pathname;
		for (const paramName of extractRouteParamNames(routePattern)) target.searchParams.delete(paramName);
		return target.href.slice(target.origin.length);
	} catch (error) {
		if (error instanceof HrefInterpolationError) throw error;
		return resolved;
	}
}
function getCurrentUrlLocale() {
	return getCurrentBrowserLocale({
		basePath: __basePath,
		domainLocales: getDomainLocales(),
		hostname: getCurrentHostname()
	});
}
function getLocalPathname(url) {
	if (typeof window === "undefined") return null;
	if (isAbsoluteOrProtocolRelativeUrl(url)) {
		const localPath = toSameOriginAppPath(url, __basePath);
		if (localPath == null) return null;
		return stripBasePath(new URL(localPath, window.location.href).pathname, __basePath);
	}
	try {
		return stripBasePath(new URL(url, window.location.href).pathname, __basePath);
	} catch {
		return null;
	}
}
function resolvePagesErrorHtmlFetchUrl(url, locale) {
	const href = resolveUrl(url);
	const errorRoutePathname = getLocalPathname(href);
	if (errorRoutePathname !== "/404" && errorRoutePathname !== "/_error") return null;
	const resolvedUrl = applyNavigationLocale(errorRoutePathname === "/_error" ? replaceUrlPathname(href, "/404") : href, locale);
	let parsed;
	try {
		parsed = new URL(resolvedUrl, window.location.href);
	} catch {
		return null;
	}
	return normalizePathTrailingSlash(toBrowserNavigationHref(`${stripBasePath(parsed.pathname, __basePath)}${parsed.search}${parsed.hash}`, window.location.href, __basePath), __trailingSlash);
}
function replaceUrlPathname(url, pathname) {
	try {
		const parsed = new URL(url, window.location.href);
		return `${pathname}${parsed.search}${parsed.hash}`;
	} catch {
		return pathname;
	}
}
function resolveTransitionLocale(locale) {
	if (typeof window === "undefined") return void 0;
	if (locale === false) return window.__VINEXT_DEFAULT_LOCALE__;
	return locale ?? getCurrentUrlLocale();
}
function getDomainLocales() {
	return window.__NEXT_DATA__?.domainLocales;
}
function getCurrentHostname() {
	return window.location?.hostname;
}
function getDomainLocalePath(url, locale) {
	return getDomainLocaleUrl(url, locale, {
		basePath: __basePath,
		currentHostname: getCurrentHostname(),
		domainItems: getDomainLocales()
	});
}
/**
* Apply locale prefix to a URL for client-side navigation.
* Same logic as Link's applyLocaleToHref but reads from window globals.
*/
function applyNavigationLocale(url, locale, replaceExistingLocale = false) {
	if (!locale || typeof window === "undefined") return url;
	if (isAbsoluteOrProtocolRelativeUrl(url)) return url;
	if (!replaceExistingLocale && getLocalePathPrefix(url, window.__VINEXT_LOCALES__)) return url;
	const normalizedUrl = replaceExistingLocale ? removeNavigationLocalePrefix(url) : url;
	const domainLocalePath = getDomainLocalePath(normalizedUrl, locale);
	if (domainLocalePath) return domainLocalePath;
	return addLocalePrefix(normalizedUrl, locale, window.__VINEXT_DEFAULT_LOCALE__ ?? "");
}
function removeNavigationLocalePrefix(url) {
	const locales = window.__VINEXT_LOCALES__;
	if (!locales?.length) return url;
	try {
		const parsed = new URL(url, "http://vinext.local");
		const locale = getLocalePathPrefix(parsed.pathname, locales);
		if (!locale) return url;
		return `${parsed.pathname.slice(locale.length + 1) || "/"}${parsed.search}${parsed.hash}`;
	} catch {
		return url;
	}
}
function isDefaultLocaleRootNavigation(url, locale) {
	if (typeof window === "undefined") return false;
	if (!locale || locale !== window.__VINEXT_DEFAULT_LOCALE__) return false;
	let parsed;
	try {
		parsed = new URL(url, window.location.href);
	} catch {
		return false;
	}
	return stripBasePath(parsed.pathname, __basePath) === "/";
}
function getPagesHtmlFetchUrl(browserUrl, locale) {
	if (!isDefaultLocaleRootNavigation(browserUrl, locale)) return browserUrl;
	const parsed = new URL(browserUrl, window.location.href);
	return normalizePathTrailingSlash(toBrowserNavigationHref(`${normalizePathTrailingSlash(`/${locale}`, __trailingSlash)}${parsed.search}${parsed.hash}`, window.location.href, __basePath), __trailingSlash);
}
/** Resolve a hash URL to a basePath-stripped app URL for event payloads */
function resolveHashUrl(url) {
	if (typeof window === "undefined") return url;
	if (url.startsWith("#")) return stripBasePath(window.location.pathname, __basePath) + window.location.search + url;
	try {
		const parsed = new URL(url, window.location.href);
		return stripBasePath(parsed.pathname, __basePath) + parsed.search + parsed.hash;
	} catch {
		return url;
	}
}
/** Check if a href is only a hash change relative to the current URL */
function isHashOnlyChange(href) {
	if (href.startsWith("#")) return true;
	if (typeof window === "undefined") return false;
	return isHashOnlyBrowserUrlChange(href, window.location.href, __basePath);
}
/**
* Build router-shaped state for the initial document entry. Captures the
* active locale (from `window.__VINEXT_LOCALE__`) so a back-navigation
* popstate to this entry can recover its locale instead of falling back to
* the live window global — the locale may have changed by the time the user
* navigates back.
*/
function buildInitialRouterState() {
	const appPath = stripBasePath(window.location.pathname, __basePath) + window.location.search;
	const options = {};
	if (window.__VINEXT_LOCALE__ !== void 0) options.locale = window.__VINEXT_LOCALE__;
	return {
		url: appPath,
		as: appPath,
		options,
		__N: true,
		key: createHistoryKey()
	};
}
/**
* Stamp the initial document entry with router-shaped state (only if no
* state is present). Called once at runtime install so the entry has a
* locale stamped before any push could overwrite the active locale global.
*/
function stampInitialHistoryState() {
	installManualScrollRestoration();
	if (!window.history) return;
	const existingState = window.history.state;
	if (existingState !== null && existingState !== void 0) {
		routerRuntimeState.currentHistoryKey = getRouterStateKey(existingState) ?? routerRuntimeState.currentHistoryKey;
		return;
	}
	const initialState = buildInitialRouterState();
	routerRuntimeState.currentHistoryKey = initialState.key;
	window.history.replaceState(initialState, "");
}
setStampInitialHistoryState(stampInitialHistoryState);
/** Save current scroll position into history state for back/forward restoration.
*
* Merging into the existing state preserves any router-owned fields (`__N`,
* `url`, `as`, `options`, `key`). If the install-time stamp didn't run
* (Router.push called before installPagesRouterRuntime), fall back to
* minting the same shape here so the entry isn't treated as foreign.
*/
function saveScrollPosition() {
	const position = getWindowScrollPosition();
	const existing = isUnknownRecord(window.history.state) ? window.history.state : null;
	const scroll = {
		__vinext_scrollX: position.x,
		__vinext_scrollY: position.y
	};
	const base = existing ?? buildInitialRouterState();
	const key = getRouterStateKey(base);
	if (key !== void 0) {
		routerRuntimeState.currentHistoryKey = key;
		saveScrollPositionToSessionStorage(key, position);
	}
	window.history.replaceState({
		...base,
		...scroll
	}, "");
}
function getWindowScrollPosition() {
	return {
		x: window.scrollX,
		y: window.scrollY
	};
}
function getScrollStorageKey(historyKey) {
	return `__next_scroll_${historyKey}`;
}
function readScrollPosition(value) {
	if (!isUnknownRecord(value)) return null;
	const nextX = value.x;
	const nextY = value.y;
	if (typeof nextX === "number" && typeof nextY === "number") return {
		x: nextX,
		y: nextY
	};
	const vinextX = value.__vinext_scrollX;
	const vinextY = value.__vinext_scrollY;
	if (typeof vinextX === "number" && typeof vinextY === "number") return {
		x: vinextX,
		y: vinextY
	};
	return null;
}
function saveScrollPositionToSessionStorage(key, position) {
	if (!manualScrollRestoration) return;
	try {
		window.sessionStorage.setItem(getScrollStorageKey(key), JSON.stringify(position));
	} catch {}
}
function readScrollPositionFromSessionStorage(key) {
	if (!manualScrollRestoration) return null;
	try {
		const value = window.sessionStorage.getItem(getScrollStorageKey(key));
		if (value === null) return null;
		return readScrollPosition(JSON.parse(value));
	} catch {
		return null;
	}
}
let _ssrContext = null;
let _getSSRContext = () => _ssrContext;
let _setSSRContextImpl = (ctx) => {
	_ssrContext = ctx;
};
/**
* Register ALS-backed state accessors. Called by router-state.ts on import.
* @internal
*/
function _registerRouterStateAccessors(accessors) {
	_getSSRContext = accessors.getSSRContext;
	_setSSRContextImpl = accessors.setSSRContext;
}
function setSSRContext(ctx) {
	_setSSRContextImpl(ctx);
}
const PAGES_NAVIGATION_NOTIFY_KEY = Symbol.for("vinext.navigation.pagesNavigationNotify");
let _cachedClientPagesNavCtx = null;
let _cachedClientPagesNavCtxKey = null;
function _buildClientPagesNavigationContext(routePattern, resolvedPath, searchString, isReady, nextData) {
	const cacheKey = `${isReady ? "1" : "0"}|${routePattern}|${resolvedPath}|${searchString}`;
	if (_cachedClientPagesNavCtxKey === cacheKey && _cachedClientPagesNavCtx) return _cachedClientPagesNavCtx;
	const searchParams = isReady ? new URLSearchParams(searchString) : new URLSearchParams();
	const params = isReady ? extractRouteParamsFromPath(routePattern, resolvedPath) ?? getRouteParamsFromQuery(routePattern, nextData?.query ?? {}) ?? {} : null;
	const isAutoExportDynamic = nextData?.autoExport === true && extractRouteParamNames(routePattern).length > 0;
	const ctx = {
		pathname: resolvePagesNavigationPathname(resolvedPath, nextData?.isFallback === true, isAutoExportDynamic, isReady),
		searchParams,
		params
	};
	_cachedClientPagesNavCtx = ctx;
	_cachedClientPagesNavCtxKey = cacheKey;
	return ctx;
}
const _ssrPagesNavCtxCache = /* @__PURE__ */ new WeakMap();
/**
* Cross-router compat shim source for `next/navigation` hooks.
*
* Returns the current Pages Router state shaped as a navigation context so
* the App Router hooks (useParams/useSearchParams/usePathname) can act as
* compat shims when invoked inside a Pages Router render. Mirrors Next.js's
* `adaptForPathParams` and `adaptForSearchParams` in
* .nextjs-ref/packages/next/src/shared/lib/router/adapters.tsx, which Next.js
* uses to populate SearchParamsContext / PathParamsContext for the Pages
* Router (see packages/next/src/server/render.tsx and
* packages/next/src/client/index.tsx).
*
* Returns `null` when there is no Pages Router state available — e.g. App
* Router pages, RSC-only renders, or pre-router renders. Callers should
* treat null as "App Router context, use normal app-router state".
*/
function getPagesNavigationContext() {
	if (typeof window === "undefined") {
		const ssrCtx = _getSSRContext();
		if (!ssrCtx) return null;
		const cached = _ssrPagesNavCtxCache.get(ssrCtx);
		if (cached) return cached;
		let searchString = "";
		let resolvedPath;
		try {
			const url = new URL(ssrCtx.asPath, "http://_");
			searchString = url.search;
			resolvedPath = url.pathname;
		} catch {
			resolvedPath = ssrCtx.pathname;
		}
		const isReady = ssrCtx.navigationIsReady ?? true;
		const searchParams = isReady ? new URLSearchParams(searchString) : new URLSearchParams();
		const params = isReady ? extractRouteParamsFromPath(ssrCtx.pathname, resolvedPath) ?? getRouteParamsFromQuery(ssrCtx.pathname, ssrCtx.query) ?? {} : null;
		const isAutoExportDynamic = ssrCtx.nextData?.autoExport === true && extractRouteParamNames(ssrCtx.pathname).length > 0;
		const ctx = {
			pathname: resolvePagesNavigationPathname(resolvedPath, ssrCtx.isFallback === true, isAutoExportDynamic, isReady),
			searchParams,
			params
		};
		_ssrPagesNavCtxCache.set(ssrCtx, ctx);
		return ctx;
	}
	if (!isPagesRouterDocumentActive()) return null;
	const resolvedPath = removeNavigationLocalePrefix(stripBasePath(window.location.pathname, __basePath));
	const nextData = window.__NEXT_DATA__;
	const pattern = resolvePagesRoutePatternForPath(nextData?.page, resolvedPath);
	if (!pattern) return null;
	return _buildClientPagesNavigationContext(pattern, resolvedPath, window.location.search, isPagesRouterReady(), nextData);
}
/**
* Extract param names from a Next.js route pattern.
* E.g., "/posts/[id]" → ["id"], "/docs/[...slug]" → ["slug"],
* "/shop/[[...path]]" → ["path"], "/blog/[year]/[month]" → ["year", "month"]
* Also handles internal format: "/posts/:id" → ["id"], "/docs/:slug+" → ["slug"]
*/
function extractRouteParamNames(pattern) {
	const names = [];
	const bracketMatches = pattern.matchAll(/\[{1,2}(?:\.\.\.)?([^\]]+)\]{1,2}/g);
	for (const m of bracketMatches) names.push(m[1]);
	if (names.length > 0) return names;
	const colonMatches = pattern.matchAll(/:([^/+*]+)[+*]?/g);
	for (const m of colonMatches) names.push(m[1]);
	return names;
}
/**
* Resolve the `pathname` snapshot for the Pages Router navigation context.
* Shared by the client and SSR branches of `getPagesNavigationContext` so both
* runtimes derive identical null-ness — diverging here would reintroduce a
* hydration mismatch. Returns `null` for a `getStaticPaths` fallback shell or a
* pre-ready auto-export dynamic route (the live path is published once the
* client router becomes ready).
*/
function resolvePagesNavigationPathname(resolvedPath, isFallback, isAutoExportDynamic, isReady) {
	return isFallback || isAutoExportDynamic && !isReady ? null : resolvedPath;
}
let _cachedPagesRoutePatternKey = null;
let _cachedPagesRoutePattern;
function resolvePagesRoutePatternForPath(nextDataPage, resolvedPath) {
	if (nextDataPage && extractRouteParamNames(nextDataPage).length > 0) return nextDataPage;
	const cacheKey = `${nextDataPage ?? ""}|${resolvedPath}`;
	if (_cachedPagesRoutePatternKey === cacheKey) return _cachedPagesRoutePattern;
	let resolved = nextDataPage;
	for (const pattern of window.__VINEXT_PAGE_PATTERNS__ ?? []) if (matchRoutePattern(splitPathSegments(resolvedPath), routePatternParts(pattern))) {
		resolved = pattern;
		break;
	}
	_cachedPagesRoutePatternKey = cacheKey;
	_cachedPagesRoutePattern = resolved;
	return resolved;
}
function getSerializedRouteQuery(nextData) {
	const query = {};
	for (const [key, value] of Object.entries(nextData?.query ?? {})) if (typeof value === "string") query[key] = value;
	else if (Array.isArray(value)) query[key] = [...value];
	return query;
}
function extractRouteParamsFromPath(pattern, pathname) {
	return matchRoutePattern(splitPathSegments(pathname), routePatternParts(pattern));
}
function getRouteParamsFromQuery(pattern, query) {
	const names = extractRouteParamNames(pattern);
	if (names.length === 0) return null;
	const params = {};
	let hasParam = false;
	for (const name of names) {
		const value = query[name];
		if (typeof value === "string") {
			params[name] = value;
			hasParam = true;
		} else if (Array.isArray(value)) {
			params[name] = [...value];
			hasParam = true;
		}
	}
	return hasParam ? params : null;
}
function getRouteQueryFromNextData(nextData, resolvedPath) {
	const routeQuery = {};
	if (!nextData?.query || !nextData.page) return routeQuery;
	if (extractRouteParamsFromPath(nextData.page, resolvedPath) === null) {
		for (const [key, value] of Object.entries(nextData.query)) if (typeof value === "string") routeQuery[key] = value;
		else if (Array.isArray(value)) routeQuery[key] = [...value];
		return routeQuery;
	}
	const routeParamNames = extractRouteParamNames(nextData.page);
	if (routeParamNames.length === 0) return routeQuery;
	const currentRouteParams = extractRouteParamsFromPath(nextData.page, resolvedPath);
	if (currentRouteParams) return currentRouteParams;
	for (const key of routeParamNames) {
		const value = nextData.query[key];
		if (typeof value === "string") routeQuery[key] = value;
		else if (Array.isArray(value)) routeQuery[key] = [...value];
	}
	return routeQuery;
}
function getPathnameAndQuery() {
	if (typeof window === "undefined") {
		const _ssrCtx = _getSSRContext();
		if (_ssrCtx) {
			const query = {};
			for (const [key, value] of Object.entries(_ssrCtx.query)) query[key] = Array.isArray(value) ? [...value] : value;
			return {
				pathname: _ssrCtx.pathname,
				query,
				asPath: _ssrCtx.asPath
			};
		}
		return {
			pathname: "/",
			query: {},
			asPath: "/"
		};
	}
	const resolvedPath = stripBasePath(window.location.pathname, __basePath);
	const canonicalResolvedPath = removeNavigationLocalePrefix(resolvedPath);
	const pathname = window.__NEXT_DATA__?.page ?? canonicalResolvedPath;
	const nextData = window.__NEXT_DATA__;
	if (!isPagesRouterReady() && !routerRuntimeState.routerDidNavigate && nextData) return {
		pathname,
		query: getSerializedRouteQuery(nextData),
		asPath: getCurrentHistoryAsPath() ?? canonicalResolvedPath + window.location.search + window.location.hash
	};
	const routeQuery = getRouteQueryFromNextData(nextData, resolvedPath);
	const searchQuery = {};
	const params = new URLSearchParams(window.location.search);
	for (const [key, value] of params) addQueryParam(searchQuery, key, value);
	return {
		pathname,
		query: {
			...searchQuery,
			...routeQuery
		},
		asPath: getCurrentHistoryAsPath() ?? canonicalResolvedPath + window.location.search + window.location.hash
	};
}
function getCurrentHistoryAsPath() {
	const state = window.history?.state;
	if (!isNextRouterState(state) || typeof state.as !== "string") return null;
	try {
		const browserUrl = new URL(window.location.href);
		const stateLocale = state.options.locale === false ? void 0 : state.options.locale;
		const localizedStateAs = applyNavigationLocale(state.as, stateLocale);
		const stateUrl = new URL(toBrowserNavigationHref(localizedStateAs, window.location.href, __basePath), window.location.href);
		if (stateUrl.pathname !== browserUrl.pathname || stateUrl.search !== browserUrl.search) return null;
		const stateAs = removeNavigationLocalePrefix(stripHash(state.as));
		const visibleAs = `${removeNavigationLocalePrefix(stripBasePath(window.location.pathname, __basePath))}${window.location.search}`;
		return `${stateAs || visibleAs}${window.location.hash}`;
	} catch {
		return null;
	}
}
function getPagesNavigationIsReadyFromSerializedState(routePattern, searchString, nextData) {
	if (!routePattern) return true;
	if (nextData?.gssp === true || nextData?.gip === true || nextData?.isExperimentalCompile === true || nextData?.appGip === true && nextData.gsp !== true) return true;
	const autoExportDynamic = nextData?.autoExport === true && extractRouteParamNames(routePattern).length > 0;
	const hasSearch = searchString.length > 0;
	const hasRewrites = nextData?.__vinext?.hasRewrites === true;
	return !autoExportDynamic && !hasSearch && !hasRewrites;
}
function shouldDeferInitialPagesRouterReady() {
	if (typeof window === "undefined") return false;
	const nextData = window.__NEXT_DATA__;
	if (!nextData) return false;
	return !getPagesNavigationIsReadyFromSerializedState(nextData.page, window.location.search, nextData);
}
function isPagesRouterReady() {
	return routerRuntimeState.pagesRouterReady;
}
function isPagesRouterDocumentActive() {
	if (typeof window === "undefined") return true;
	if (window.__VINEXT_PAGE_LOADERS__) return true;
	if (window.next?.appDir === true) return false;
	if (window.next?.router) return true;
	return Boolean(window.__VINEXT_APP__ || window.__VINEXT_APP_LOADER__);
}
function markPagesRouterReady() {
	if (typeof window === "undefined" || routerRuntimeState.pagesRouterReady) return false;
	routerRuntimeState.pagesRouterReady = true;
	return true;
}
function initializePagesRouterReadyFromNextData(nextData, forceReady = false) {
	if (typeof window === "undefined") return;
	routerRuntimeState.pagesRouterReady = forceReady || getPagesNavigationIsReadyFromSerializedState(nextData.page, window.location.search, nextData);
}
function markPagesRouterHydrated() {
	if (typeof window === "undefined" || window.__NEXT_HYDRATED === true) return;
	const hydratedAt = performance.now();
	window.__VINEXT_HYDRATED_AT = hydratedAt;
	window.__NEXT_HYDRATED = true;
	window.__NEXT_HYDRATED_AT = hydratedAt;
	window.__NEXT_HYDRATED_CB?.();
}
function PagesRouterHydrationMarker() {
	useEffect(() => {
		markPagesRouterHydrated();
	}, []);
	return null;
}
function getRouterSnapshot() {
	const isReady = typeof window === "undefined" ? _getSSRContext()?.navigationIsReady ?? true : isPagesRouterReady();
	return {
		...getPathnameAndQuery(),
		isReady
	};
}
function notifyNextNavigationPagesContext() {
	const notify = globalThis[PAGES_NAVIGATION_NOTIFY_KEY];
	notify?.();
}
/**
* Error thrown when a navigation is superseded by a newer one.
* Matches Next.js's convention of an Error with `.cancelled = true`.
*/
var NavigationCancelledError = class extends Error {
	cancelled = true;
	constructor(route) {
		super(`Abort fetching component for route: "${route}"`);
		this.name = "NavigationCancelledError";
	}
};
/**
* Error thrown after queueing a hard navigation fallback for a known failure
* mode. Callers can use this to avoid scheduling the same hard navigation twice.
*/
var HardNavigationScheduledError = class extends Error {
	hardNavigationScheduled = true;
	constructor(message) {
		super(message);
		this.name = "HardNavigationScheduledError";
	}
};
function cancelPreviousRenderCommit() {
	routerRuntimeState.cancelPendingRenderCommit?.();
	routerRuntimeState.cancelPendingRenderCommit = null;
}
function scheduleHardNavigationAndThrow(url, message) {
	assertSafeNavigationUrl(url, HardNavigationScheduledError);
	if (typeof window === "undefined") throw new HardNavigationScheduledError(message);
	window.location.href = url;
	throw new HardNavigationScheduledError(message);
}
function isPageComponent(value) {
	if (typeof value === "function") return true;
	if (!isUnknownRecord(value)) return false;
	return value.$$typeof === Symbol.for("react.forward_ref") || value.$$typeof === Symbol.for("react.memo");
}
function isAppComponent(value) {
	return isPageComponent(value);
}
function resolveSameOriginRedirectedUrl(responseUrl) {
	const appPath = toSameOriginAppPath(responseUrl, __basePath);
	if (appPath === null) return null;
	return normalizePathTrailingSlash(toBrowserNavigationHref(appPath, window.location.href, __basePath), __trailingSlash);
}
function stripLocalePrefixForApiRedirect(appPath) {
	const locales = window.__VINEXT_LOCALES__;
	if (!locales || locales.length === 0) return appPath;
	try {
		const parsed = new URL(appPath, "http://vinext.local");
		const pathname = stripBasePath(parsed.pathname, __basePath);
		const firstSegment = pathname.split("/")[1];
		if (!firstSegment || !locales.includes(firstSegment)) return appPath;
		const withoutLocale = pathname.slice(firstSegment.length + 1) || "/";
		if (withoutLocale !== "/api" && !withoutLocale.startsWith("/api/")) return appPath;
		return `${withoutLocale}${parsed.search}${parsed.hash}`;
	} catch {
		return appPath;
	}
}
function resolveLocalRedirectUrl(location) {
	let appPath;
	if (location.startsWith("/") && !location.startsWith("//")) try {
		const parsed = new URL(location, "http://vinext.local");
		appPath = stripBasePath(parsed.pathname, __basePath) + parsed.search + parsed.hash;
	} catch {
		appPath = location;
	}
	else appPath = toSameOriginAppPath(location, __basePath);
	if (appPath === null) return null;
	return normalizePathTrailingSlash(toBrowserNavigationHref(stripLocalePrefixForApiRedirect(appPath), window.location.href, __basePath), __trailingSlash);
}
function hasClientRewriteRules() {
	const rewrites = window.__VINEXT_CLIENT_REWRITES__;
	return Boolean(rewrites && (rewrites.beforeFiles.length > 0 || rewrites.afterFiles.length > 0 || rewrites.fallback.length > 0));
}
function hasClientRedirectRules() {
	const redirects = window.__VINEXT_CLIENT_REDIRECTS__;
	return Array.isArray(redirects) && redirects.length > 0;
}
function hasClientAppRouteManifest() {
	const routes = window.__VINEXT_LINK_PREFETCH_ROUTES__;
	return Array.isArray(routes) && routes.length > 0;
}
function getClientConfigRouteContext(href) {
	let parsed;
	try {
		parsed = new URL(href, window.location.href);
	} catch {
		return null;
	}
	if (parsed.origin !== getWindowOrigin()) return null;
	const hadBasePath = __basePath ? hasBasePath(parsed.pathname, __basePath) : true;
	const pathname = hadBasePath ? stripBasePath(parsed.pathname, __basePath) : parsed.pathname;
	const headers = new Headers({ "user-agent": globalThis.navigator?.userAgent ?? "" });
	return {
		basePathState: {
			basePath: __basePath,
			hadBasePath
		},
		context: {
			cookies: parseCookieHeader(globalThis.document?.cookie ?? ""),
			headers,
			host: parsed.hostname,
			query: parsed.searchParams
		},
		pathname,
		search: parsed.search
	};
}
async function resolveClientConfigRedirect(href) {
	const redirects = window.__VINEXT_CLIENT_REDIRECTS__;
	if (!redirects || redirects.length === 0) return null;
	const routeContext = getClientConfigRouteContext(href);
	if (!routeContext) return null;
	const { matchRedirect, preserveRedirectDestinationQuery } = await import("../config/config-matchers.js");
	const redirect = matchRedirect(routeContext.pathname, redirects, routeContext.context, routeContext.basePathState);
	if (!redirect) return null;
	return preserveRedirectDestinationQuery(__basePath && routeContext.basePathState.hadBasePath && !isExternalUrl(redirect.destination) && !hasBasePath(redirect.destination, __basePath) ? __basePath + redirect.destination : redirect.destination, routeContext.search);
}
async function applyClientConfigRewrite(href, rewrite) {
	const routeContext = getClientConfigRouteContext(href);
	if (!routeContext) return null;
	const { matchRewrite } = await import("../config/config-matchers.js");
	const rewritten = matchRewrite(routeContext.pathname, [rewrite], routeContext.context, routeContext.basePathState);
	if (rewritten === null) return null;
	if (isExternalUrl(rewritten)) return { kind: "document" };
	return {
		href: mergeRewriteQuery(href, rewritten),
		kind: "rewrite"
	};
}
function shouldEvaluateClientConfigRule(ruleBasePath, state) {
	if (!state.basePath) return true;
	return ruleBasePath === false ? !state.hadBasePath : state.hadBasePath;
}
function matchSimpleClientConfigPattern(pathname, source) {
	if (source.includes("(") || source.includes("\\") || /:[\w-]+[*+][^/]/.test(source)) return;
	const sourceParts = removeTrailingSlash(source).split("/");
	const pathParts = removeTrailingSlash(pathname).split("/");
	const params = {};
	let pathIndex = 0;
	for (let sourceIndex = 0; sourceIndex < sourceParts.length; sourceIndex++) {
		const sourcePart = sourceParts[sourceIndex];
		const pathPart = pathParts[pathIndex];
		if (sourcePart.startsWith(":")) {
			const catchAll = sourcePart.match(/^:([\w-]+)([*+])$/);
			if (catchAll) {
				const rest = pathParts.slice(pathIndex).join("/");
				if (catchAll[2] === "+" && rest === "") return null;
				params[catchAll[1]] = rest;
				return sourceIndex === sourceParts.length - 1 ? params : void 0;
			}
			if (pathPart === void 0) return null;
			params[sourcePart.slice(1)] = pathPart;
			pathIndex++;
			continue;
		}
		if (pathPart !== sourcePart) return null;
		pathIndex++;
	}
	return pathIndex === pathParts.length ? params : null;
}
function simpleClientConfigSourceCouldMatch(pathname, source) {
	const wildcardIndex = source.search(/[:(\\*+?]/);
	const normalizedPrefix = removeTrailingSlash(wildcardIndex === -1 ? source : source.slice(0, wildcardIndex));
	if (!normalizedPrefix || normalizedPrefix === "/") return true;
	const normalizedPathname = removeTrailingSlash(pathname);
	return normalizedPathname === normalizedPrefix || normalizedPathname.startsWith(`${normalizedPrefix}/`);
}
function substituteSimpleClientConfigDestination(destination, params) {
	const keys = Object.keys(params);
	if (keys.length === 0) return destination;
	const alternation = keys.sort((a, b) => b.length - a.length).map((key) => key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
	return destination.replace(new RegExp(`:(${alternation})([+*])?(?![A-Za-z0-9_])`, "g"), (_token, key) => params[key] ?? _token);
}
function isExternalClientConfigUrl(url) {
	return /^[a-z][a-z0-9+.-]*:/i.test(url) || url.startsWith("//");
}
function clientConfigRedirectCouldMatch(href) {
	const redirects = window.__VINEXT_CLIENT_REDIRECTS__;
	if (!redirects || redirects.length === 0) return false;
	const routeContext = getClientConfigRouteContext(href);
	if (!routeContext) return false;
	for (const redirect of redirects) {
		if (!shouldEvaluateClientConfigRule(redirect.basePath, routeContext.basePathState)) continue;
		if (!simpleClientConfigSourceCouldMatch(routeContext.pathname, redirect.source)) continue;
		if (matchSimpleClientConfigPattern(routeContext.pathname, redirect.source) !== null) return true;
	}
	return false;
}
function resolveClientConfigRewriteSync(href) {
	const rewrites = window.__VINEXT_CLIENT_REWRITES__;
	if (!rewrites) return null;
	let currentHref = href;
	let matched = false;
	for (const rewrite of rewrites.beforeFiles) {
		const routeContext = getClientConfigRouteContext(currentHref);
		if (!routeContext) return null;
		if (!shouldEvaluateClientConfigRule(rewrite.basePath, routeContext.basePathState)) continue;
		if (!simpleClientConfigSourceCouldMatch(routeContext.pathname, rewrite.source)) continue;
		if (rewrite.has || rewrite.missing) return void 0;
		const params = matchSimpleClientConfigPattern(routeContext.pathname, rewrite.source);
		if (params === void 0) return void 0;
		if (params === null) continue;
		const rewritten = substituteSimpleClientConfigDestination(rewrite.destination, params);
		if (isExternalClientConfigUrl(rewritten)) return { kind: "document" };
		currentHref = mergeRewriteQuery(currentHref, rewritten);
		matched = true;
	}
	return matched ? {
		href: currentHref,
		kind: "rewrite"
	} : null;
}
async function resolveClientConfigRewrite(href) {
	const rewrites = window.__VINEXT_CLIENT_REWRITES__;
	if (!rewrites) return null;
	let currentHref = href;
	let matched = false;
	for (const rewrite of rewrites.beforeFiles) {
		const result = await applyClientConfigRewrite(currentHref, rewrite);
		if (result?.kind === "document") return result;
		if (result?.kind !== "rewrite") continue;
		currentHref = result.href;
		matched = true;
	}
	return matched ? {
		href: currentHref,
		kind: "rewrite"
	} : null;
}
function getMiddlewarePagesDataFetchUrl(browserUrl, dataTarget) {
	const middlewareDataHref = getPagesMiddlewareDataHref(browserUrl, __basePath);
	if (!middlewareDataHref) return null;
	if (dataTarget?.dataKind === "static" && dataTarget.middlewareDataHref === middlewareDataHref && dataTarget.prefetchDataHref) return dataTarget.prefetchDataHref;
	return middlewareDataHref;
}
function getPagesDataCacheHref(dataHref) {
	try {
		return new URL(dataHref, window.location.href).href;
	} catch {
		return dataHref;
	}
}
function shouldEvictMiddlewareDataCache(middlewareEffect, dataTarget) {
	return middlewareEffect?.redirectLocation != null || dataTarget?.dataKind !== "static";
}
async function resolveMiddlewareDataEffect(browserUrl, signal, dataTarget) {
	const dataUrl = getMiddlewarePagesDataFetchUrl(browserUrl, dataTarget);
	if (!dataUrl) return null;
	if (signal.aborted) throw new DOMException("Aborted", "AbortError");
	try {
		const res = await fetchCachedPagesData(dataUrl, {
			headers: {
				Accept: "application/json",
				"x-nextjs-data": "1"
			},
			signal
		});
		return {
			dataHref: getPagesDataCacheHref(dataUrl),
			redirectLocation: res.headers.get("x-nextjs-redirect"),
			rewriteTarget: res.headers.get("x-nextjs-rewrite"),
			response: res
		};
	} catch {
		return null;
	}
}
/**
* React to a gSSP/gSP `__N_REDIRECT` marker returned on a client data
* navigation.
*
* Internal destinations (absolute paths, unless the redirect opted out of
* basePath via `__N_REDIRECT_BASE_PATH === false`) are followed with a fresh
* client-side navigation that preserves the originating push/replace mode. The
* fresh navigation increments the navigation id, so the navigation that
* produced this redirect is superseded and never commits the intermediate
* page. External (or non-absolute) destinations fall back to a hard navigation.
*
* Ported from Next.js: packages/next/src/shared/lib/router/router.ts
* (`pageProps.__N_REDIRECT` handling — internal `this.change` vs
* `handleHardNavigation`).
*/
function handleDataRedirect(destination, redirectBasePath, mode = "push") {
	if (!(destination.startsWith("/") && redirectBasePath !== false)) scheduleHardNavigationAndThrow(destination, "Navigation redirected externally");
	performNavigation(destination, void 0, { locale: false }, mode);
}
async function loadTargetPageModule(target, url, failurePrefix) {
	try {
		return await target.loader();
	} catch (err) {
		console.error("[vinext] Page loader threw during navigation:", err);
		scheduleHardNavigationAndThrow(url, `${failurePrefix}: page loader threw`);
	}
}
async function loadPagesAppComponent() {
	let AppComponent = window.__VINEXT_APP__;
	if (!AppComponent && typeof window.__VINEXT_APP_LOADER__ === "function") try {
		const appModule = await window.__VINEXT_APP_LOADER__();
		AppComponent = isAppComponent(appModule.default) ? appModule.default : void 0;
		if (AppComponent) window.__VINEXT_APP__ = AppComponent;
	} catch {}
	return AppComponent;
}
function buildPagesNavigationNextData(target, props) {
	const mergedQuery = mergeRouteParamsIntoQuery(parseQueryString(target.search), target.params);
	const prev = window.__NEXT_DATA__;
	const nextLocale = (window.__VINEXT_LOCALES__?.length ?? 0) > 0 ? target.locale ?? window.__VINEXT_DEFAULT_LOCALE__ : prev?.locale;
	return {
		...prev,
		props,
		page: target.pattern,
		query: mergedQuery,
		buildId: target.buildId,
		isFallback: false,
		isPreview: props.__N_PREVIEW === true,
		...nextLocale !== void 0 ? { locale: nextLocale } : {}
	};
}
function propsObject(value) {
	return isUnknownRecord(value) ? value : {};
}
async function loadComponentOnlyProps(PageComponent, AppComponent, target, asPath) {
	const query = mergeRouteParamsIntoQuery(parseQueryString(target.search), target.params);
	const ctx = {
		pathname: target.pattern,
		query,
		asPath,
		locale: target.locale ?? window.__VINEXT_LOCALE__,
		locales: window.__VINEXT_LOCALES__,
		defaultLocale: window.__VINEXT_DEFAULT_LOCALE__
	};
	if (typeof AppComponent?.getInitialProps === "function") {
		const AppTree = (appProps) => createElement(AppComponent, {
			...appProps,
			Component: PageComponent,
			router: singletonRouter
		});
		return propsObject(await AppComponent.getInitialProps({
			Component: PageComponent,
			AppTree,
			ctx,
			router: singletonRouter
		}));
	}
	if (typeof PageComponent.getInitialProps === "function") return { pageProps: propsObject(await PageComponent.getInitialProps(ctx)) };
	return { pageProps: {} };
}
async function renderPagesNavigationTarget(url, target, props, options, assertStillCurrent, preloaded) {
	const pageModule = preloaded?.pageModule ?? await loadTargetPageModule(target, url, "Navigation failed");
	assertStillCurrent();
	const PageComponent = pageModule.default;
	if (!isPageComponent(PageComponent)) scheduleHardNavigationAndThrow(url, "Navigation failed: page module default export is not a component");
	const AppComponent = preloaded?.appComponent ?? await loadPagesAppComponent();
	assertStillCurrent();
	const React = (await import("react")).default;
	assertStillCurrent();
	const rawPageProps = props.pageProps;
	const pageProps = isUnknownRecord(rawPageProps) ? rawPageProps : {};
	let element;
	if (AppComponent) element = React.createElement(AppComponent, {
		...props,
		Component: PageComponent,
		pageProps: rawPageProps,
		router: singletonRouter
	});
	else element = React.createElement(PageComponent, pageProps);
	const nextData = buildPagesNavigationNextData(target, props);
	window.__NEXT_DATA__ = nextData;
	applyVinextLocaleGlobals(window, nextData);
	await renderPagesRouterElement(element, options.scroll);
	assertStillCurrent();
}
async function navigateClientNoData(url, target, controller, assertStillCurrent, options = {}) {
	if (!window.__VINEXT_ROOT__) {
		window.location.href = url;
		return;
	}
	if (controller.signal.aborted) throw new NavigationCancelledError(url);
	const pageModule = await loadTargetPageModule(target, url, "Navigation failed");
	assertStillCurrent();
	const PageComponent = pageModule.default;
	if (!isPageComponent(PageComponent)) scheduleHardNavigationAndThrow(url, "Navigation failed: page module default export is not a component");
	const AppComponent = await loadPagesAppComponent();
	assertStillCurrent();
	const props = await loadComponentOnlyProps(PageComponent, AppComponent, target, url);
	assertStillCurrent();
	await renderPagesNavigationTarget(url, target, props, options, assertStillCurrent, {
		appComponent: AppComponent,
		pageModule
	});
}
/**
* Perform client-side navigation via the `/_next/data/<id>/<page>.json`
* endpoint. Used when `__VINEXT_PAGE_LOADERS__` has a matching code-split
* loader for the target pattern (the prod hot path). Falls back to the
* HTML extraction path (`navigateClientHtml`) when this returns `null`.
*
* Failure modes (404, 5xx, network, parse, missing loader, soft redirect)
* all queue a hard navigation and throw `HardNavigationScheduledError`,
* mirroring the existing HTML-path failure protocol. The hard reload is
* the deploy-skew safety net: when the server's buildId has rotated, the
* data endpoint returns 404 and the client lands on the new build via a
* full document load.
*/
async function navigateClientData(url, initialTarget, controller, navId, assertStillCurrent, options = {}, prefetchedResponse) {
	if (!window.__VINEXT_ROOT__) {
		window.location.href = url;
		return;
	}
	if (controller.signal.aborted) throw new NavigationCancelledError(url);
	let res = prefetchedResponse;
	if (!res) try {
		const headers = {
			Accept: "application/json",
			"x-nextjs-data": "1"
		};
		const deploymentId = getDeploymentId();
		if (deploymentId) headers[NEXT_DEPLOYMENT_ID_HEADER] = deploymentId;
		res = await (initialTarget.dataKind === "static" && singletonRouter.isPreview !== true ? fetchStaticPagesData : dedupedPagesDataFetch)(initialTarget.dataHref, {
			headers,
			signal: controller.signal
		});
	} catch (err) {
		if (err instanceof DOMException && err.name === "AbortError") throw new NavigationCancelledError(url);
		throw err;
	}
	assertStillCurrent();
	const responseDeploymentId = res.headers.get("x-nextjs-deployment-id");
	const currentDeploymentId = getDeploymentId() ?? null;
	if (responseDeploymentId !== null && responseDeploymentId !== currentDeploymentId) scheduleHardNavigationAndThrow(url, "Loaded static props were from an outdated deployment");
	const softRedirect = res.headers.get("x-nextjs-redirect");
	if (softRedirect) {
		const redirectedUrl = resolveLocalRedirectUrl(softRedirect);
		if (!redirectedUrl) scheduleHardNavigationAndThrow(softRedirect, "Navigation redirected externally");
		window.history.replaceState(window.history.state ?? {}, "", redirectedUrl);
		routerRuntimeState.lastPathnameAndSearch = window.location.pathname + window.location.search;
		routerRuntimeState.lastHash = window.location.hash;
		await navigateClientHtml(redirectedUrl, redirectedUrl, controller, navId, assertStillCurrent);
		return;
	}
	if (!res.ok) {
		if (options.isHydrationQueryUpdate) return;
		scheduleHardNavigationAndThrow(url, `Data navigation failed: ${res.status} ${res.statusText}`);
	}
	const rewriteTarget = res.headers.get("x-nextjs-rewrite");
	const target = rewriteTarget ? resolvePagesDataNavigationTarget(rewriteTarget, __basePath, { locale: initialTarget.prefetchLocale }) : initialTarget;
	if (!target) scheduleHardNavigationAndThrow(url, "Data navigation failed: rewrite target has no page loader");
	let body;
	try {
		body = await res.json();
	} catch {
		if (options.isHydrationQueryUpdate) return;
		scheduleHardNavigationAndThrow(url, "Data navigation failed: invalid JSON response");
	}
	assertStillCurrent();
	const props = isUnknownRecord(body) ? body : {};
	const rawPageProps = props.pageProps;
	const pageProps = isUnknownRecord(rawPageProps) ? rawPageProps : {};
	if (initialTarget.dataKind === "server") evictPagesDataCache(initialTarget.dataHref);
	if (props.__N_PREVIEW === true || singletonRouter.isPreview === true) evictPagesDataCache(initialTarget.dataHref);
	const redirectDestination = pageProps.__N_REDIRECT;
	if (typeof redirectDestination === "string") {
		handleDataRedirect(redirectDestination, pageProps.__N_REDIRECT_BASE_PATH, options.mode);
		throw new NavigationCancelledError(url);
	}
	await renderPagesNavigationTarget(url, target, props, options, assertStillCurrent);
}
/**
* Perform client-side navigation by fetching the page's full HTML and
* extracting `__NEXT_DATA__` plus the page module URL. Used in dev (where
* the per-page inline hydration script does not populate the loader map) and
* as a generic fallback when the data path is not available.
*
* Throws NavigationCancelledError if a newer navigation supersedes this one.
* Throws on hard-navigation failures (non-OK response, missing data) so the
* caller can distinguish success from failure for event emission.
*/
async function navigateClientHtml(url, fetchUrl, controller, navId, assertStillCurrent, options = {}) {
	let browserUrl = url;
	let pendingRedirectHistoryUrl = fetchUrl === url ? null : url;
	if (!window.__VINEXT_ROOT__) {
		window.location.href = browserUrl;
		return;
	}
	let res;
	try {
		res = await fetch(fetchUrl, {
			headers: { Accept: "text/html" },
			signal: controller.signal
		});
	} catch (err) {
		if (err instanceof DOMException && err.name === "AbortError") throw new NavigationCancelledError(url);
		throw err;
	}
	assertStillCurrent();
	if (res.redirected && res.url) {
		const redirectedUrl = resolveSameOriginRedirectedUrl(res.url);
		if (redirectedUrl) {
			browserUrl = redirectedUrl;
			pendingRedirectHistoryUrl = redirectedUrl;
		}
	}
	if (!res.ok && !(options.allowNotFoundResponse === true && res.status === 404)) scheduleHardNavigationAndThrow(browserUrl, `Navigation failed: ${res.status} ${res.statusText}`);
	const html = await res.text();
	assertStillCurrent();
	const nextDataJson = extractVinextNextDataJson(html);
	if (!nextDataJson) scheduleHardNavigationAndThrow(url, "Navigation failed: missing __NEXT_DATA__ in response");
	const nextData = parseVinextNextDataJson(nextDataJson);
	const props = nextData.props && typeof nextData.props === "object" ? nextData.props : {};
	const rawPageProps = props.pageProps;
	const pageProps = isUnknownRecord(rawPageProps) ? rawPageProps : {};
	let pageModuleUrl = nextData.__vinext?.pageModuleUrl;
	if (!pageModuleUrl) {
		const moduleMatch = html.match(/import\("([^"]+)"\);\s*\n\s*const PageComponent/);
		const altMatch = html.match(/await import\("([^"]+pages\/[^"]+)"\)/);
		pageModuleUrl = moduleMatch?.[1] ?? altMatch?.[1] ?? void 0;
	}
	let pageModule;
	const loader = window.__VINEXT_PAGE_LOADERS__?.[nextData.page];
	if (loader) pageModule = await loader();
	else if (!pageModuleUrl) scheduleHardNavigationAndThrow(browserUrl, "Navigation failed: no page module URL found");
	else {
		if (!isValidModulePath(pageModuleUrl)) {
			console.error("[vinext] Blocked import of invalid page module path:", pageModuleUrl);
			scheduleHardNavigationAndThrow(browserUrl, "Navigation failed: invalid page module path");
		}
		pageModule = await import(
			/* @vite-ignore */
			pageModuleUrl
);
	}
	assertStillCurrent();
	const PageComponent = pageModule.default;
	if (!isPageComponent(PageComponent)) scheduleHardNavigationAndThrow(browserUrl, "Navigation failed: page module default export is not a component");
	const React = (await import("react")).default;
	assertStillCurrent();
	let AppComponent = window.__VINEXT_APP__;
	const appModuleUrl = nextData.__vinext?.appModuleUrl;
	if (!AppComponent && appModuleUrl) if (!isValidModulePath(appModuleUrl)) console.error("[vinext] Blocked import of invalid app module path:", appModuleUrl);
	else try {
		const appModule = await import(
			/* @vite-ignore */
			appModuleUrl
);
		AppComponent = isAppComponent(appModule.default) ? appModule.default : void 0;
		window.__VINEXT_APP__ = AppComponent;
	} catch {}
	assertStillCurrent();
	let element;
	if (AppComponent) element = React.createElement(AppComponent, {
		...props,
		Component: PageComponent,
		pageProps: rawPageProps,
		router: singletonRouter
	});
	else element = React.createElement(PageComponent, pageProps);
	if (pendingRedirectHistoryUrl) {
		window.history.replaceState(window.history.state ?? {}, "", pendingRedirectHistoryUrl);
		routerRuntimeState.lastPathnameAndSearch = window.location.pathname + window.location.search;
		routerRuntimeState.lastHash = window.location.hash;
	}
	window.__NEXT_DATA__ = nextData;
	applyVinextLocaleGlobals(window, nextData);
	await renderPagesRouterElement(element, options.scroll);
	assertStillCurrent();
}
/**
* Perform client-side navigation. Prefers the JSON data endpoint when the
* client has a registered code-split loader for the target route (the prod
* hot path); otherwise falls back to fetching the page's full HTML (dev and
* any unmapped route).
*
* Throws NavigationCancelledError if a newer navigation supersedes this one.
* Throws on hard-navigation failures (non-OK response, missing data) so the
* caller can distinguish success from failure for event emission.
*
* `fetchUrl` is the HTML-path fetch URL (already includes locale-root
* fixups). The JSON path derives its own URL from the browser-facing `url`
* because the data endpoint speaks the unprefixed path.
*/
async function navigateClient(url, fetchUrl = url, options = {}, routeUrl = url) {
	if (typeof window === "undefined") return;
	const previousAbortController = routerRuntimeState.activeAbortController;
	if (previousAbortController) queueMicrotask(() => previousAbortController.abort());
	cancelPreviousRenderCommit();
	const controller = new AbortController();
	routerRuntimeState.activeAbortController = controller;
	const navId = ++routerRuntimeState.navigationId;
	let middlewareDataCacheEvictHref = null;
	/** Check if this navigation is still the active one. If not, throw. */
	function assertStillCurrent() {
		if (navId !== routerRuntimeState.navigationId) throw new NavigationCancelledError(url);
	}
	try {
		if (options.allowNotFoundResponse === true) await navigateClientHtml(url, fetchUrl, controller, navId, assertStillCurrent, options);
		else {
			let browserUrl = url;
			let htmlFetchUrl = fetchUrl;
			const configRedirect = hasClientRedirectRules() && clientConfigRedirectCouldMatch(browserUrl) ? await resolveClientConfigRedirect(browserUrl) : null;
			if (configRedirect) {
				const redirectedUrl = resolveLocalRedirectUrl(configRedirect);
				if (!redirectedUrl) scheduleHardNavigationAndThrow(configRedirect, "Navigation redirected externally");
				window.history.replaceState(window.history.state ?? {}, "", redirectedUrl);
				routerRuntimeState.lastPathnameAndSearch = window.location.pathname + window.location.search;
				routerRuntimeState.lastHash = window.location.hash;
				browserUrl = redirectedUrl;
				htmlFetchUrl = redirectedUrl;
			}
			let routeLookupUrl = configRedirect ? browserUrl : routeUrl;
			if (routeUrl === url && hasClientRewriteRules()) {
				const syncConfigRewrite = hasClientAppRouteManifest() ? void 0 : resolveClientConfigRewriteSync(browserUrl);
				const configRewrite = syncConfigRewrite === void 0 ? await resolveClientConfigRewrite(browserUrl) : syncConfigRewrite;
				if (configRewrite?.kind === "document") scheduleHardNavigationAndThrow(browserUrl, "Navigation rewritten to a document route");
				else if (configRewrite?.kind === "rewrite") {
					routeLookupUrl = configRewrite.href;
					htmlFetchUrl = configRewrite.href;
				}
			}
			const pagesDataTargetOptions = { locale: options.locale };
			let dataTarget = resolvePagesDataNavigationTarget(routeLookupUrl, __basePath, pagesDataTargetOptions);
			let middlewareDataResponse;
			let middlewareEffect = null;
			let middlewareRewrittenTarget;
			const middlewareProbeDataHref = getMiddlewarePagesDataFetchUrl(browserUrl, dataTarget);
			if (middlewareProbeDataHref !== null) {
				middlewareDataCacheEvictHref = getPagesDataCacheHref(middlewareProbeDataHref);
				try {
					middlewareEffect = await resolveMiddlewareDataEffect(browserUrl, controller.signal, dataTarget);
				} catch (err) {
					if (err instanceof DOMException && err.name === "AbortError") throw new NavigationCancelledError(browserUrl);
					throw err;
				}
				if (middlewareEffect?.rewriteTarget) middlewareRewrittenTarget = resolvePagesDataNavigationTarget(middlewareEffect.rewriteTarget, __basePath, pagesDataTargetOptions);
				if (middlewareEffect) if (shouldEvictMiddlewareDataCache(middlewareEffect, middlewareRewrittenTarget !== void 0 ? middlewareRewrittenTarget : dataTarget)) middlewareDataCacheEvictHref = middlewareEffect.dataHref;
				else middlewareDataCacheEvictHref = null;
				assertStillCurrent();
			}
			const redirectLocation = middlewareEffect?.redirectLocation ?? null;
			if (redirectLocation) {
				const redirectedUrl = resolveLocalRedirectUrl(redirectLocation);
				if (!redirectedUrl) scheduleHardNavigationAndThrow(redirectLocation, "Navigation redirected externally");
				window.history.replaceState(window.history.state ?? {}, "", redirectedUrl);
				routerRuntimeState.lastPathnameAndSearch = window.location.pathname + window.location.search;
				routerRuntimeState.lastHash = window.location.hash;
				browserUrl = redirectedUrl;
				htmlFetchUrl = redirectedUrl;
			} else if (middlewareEffect) {
				if (middlewareEffect.rewriteTarget || routeUrl === url) middlewareDataResponse = middlewareEffect.response;
				if (middlewareEffect.rewriteTarget) {
					const rewrittenOwner = resolveDirectHybridClientRouteOwner(middlewareEffect.rewriteTarget, __basePath);
					if (rewrittenOwner === "app" || rewrittenOwner === "document") scheduleHardNavigationAndThrow(browserUrl, "Navigation rewritten to a non-Pages route");
					const rewrittenTarget = middlewareRewrittenTarget ?? resolvePagesDataNavigationTarget(middlewareEffect.rewriteTarget, __basePath, pagesDataTargetOptions);
					if (!rewrittenTarget) scheduleHardNavigationAndThrow(browserUrl, "Navigation rewritten to a non-Pages route");
					dataTarget = rewrittenTarget;
				}
			}
			if (middlewareEffect && shouldEvictMiddlewareDataCache(middlewareEffect, dataTarget)) middlewareDataCacheEvictHref = middlewareEffect.dataHref;
			else if (middlewareEffect) middlewareDataCacheEvictHref = null;
			if (dataTarget?.dataKind === "static" || dataTarget?.dataKind === "server") await navigateClientData(browserUrl, dataTarget, controller, navId, assertStillCurrent, options, middlewareDataResponse);
			else if (dataTarget) await navigateClientNoData(browserUrl, dataTarget, controller, assertStillCurrent, options);
			else await navigateClientHtml(browserUrl, htmlFetchUrl, controller, navId, assertStillCurrent, options);
		}
	} finally {
		if (navId === routerRuntimeState.navigationId) routerRuntimeState.activeAbortController = null;
		if (middlewareDataCacheEvictHref !== null) evictPagesDataCache(middlewareDataCacheEvictHref);
	}
}
/**
* Run navigateClient and handle errors: emit routeChangeError on failure,
* and fall back to a hard navigation for non-cancel errors so the browser
* recovers to a consistent state.
*
* Returns:
* - "completed" — navigation finished, caller should emit routeChangeComplete
* - "cancelled" — superseded by a newer navigation, caller should return true
*   without emitting routeChangeComplete (matches Next.js behaviour)
* - "failed" — genuine error, caller should return false (hard nav is already
*   scheduled as recovery)
*/
async function runNavigateClient(fullUrl, resolvedUrl, fetchUrl = fullUrl, options = {}, routeUrl = fullUrl) {
	try {
		await navigateClient(fullUrl, fetchUrl, options, routeUrl);
		return "completed";
	} catch (err) {
		routerEvents.emit("routeChangeError", err, resolvedUrl, { shallow: false });
		if (err instanceof NavigationCancelledError) return "cancelled";
		if (typeof window !== "undefined" && !(err instanceof HardNavigationScheduledError)) window.location.href = fullUrl;
		return "failed";
	}
}
/**
* Build the full router value object from the current pathname, query, asPath,
* and a set of navigation methods. Shared by the Pages Router context provider
* and tests so the public router shape stays in sync.
*/
function buildRouterValue(pathname, query, asPath, isReady, methods) {
	const _ssrState = _getSSRContext();
	const nextData = typeof window !== "undefined" ? window.__NEXT_DATA__ : void 0;
	const locale = typeof window === "undefined" ? _ssrState?.locale : window.__VINEXT_LOCALE__;
	const locales = typeof window === "undefined" ? _ssrState?.locales : window.__VINEXT_LOCALES__;
	const defaultLocale = typeof window === "undefined" ? _ssrState?.defaultLocale : window.__VINEXT_DEFAULT_LOCALE__;
	const domainLocales = typeof window === "undefined" ? _ssrState?.domainLocales : nextData?.domainLocales;
	return {
		pathname,
		route: typeof window !== "undefined" ? nextData?.page ?? pathname : pathname,
		query,
		asPath,
		basePath: __basePath,
		locale,
		locales,
		defaultLocale,
		domainLocales,
		isLocaleDomain: typeof window !== "undefined" && domainLocales?.some((domain) => domain.domain === window.location.hostname) === true,
		isReady,
		isPreview: typeof window !== "undefined" ? nextData?.isPreview === true : _ssrState?.isPreview === true,
		isFallback: typeof window !== "undefined" ? nextData?.isFallback === true : _ssrState?.isFallback === true,
		...methods,
		events: routerEvents
	};
}
/** Extract the hash fragment from a URL, including the leading `#`. */
function extractHash(url) {
	const i = url.indexOf("#");
	return i === -1 ? "" : url.slice(i);
}
/** Return the URL with any trailing `#fragment` removed. */
function stripHash(url) {
	const i = url.indexOf("#");
	return i === -1 ? url : url.slice(0, i);
}
/** Notify in-page listeners (e.g. useRouter hooks) that navigation occurred. */
function dispatchNavigateEvent() {
	notifyNextNavigationPagesContext();
	window.dispatchEvent(new CustomEvent("vinext:navigate"));
}
/**
* Update history with the new URL and refresh the hash-only-detection tracker.
* Centralises the `pushState`/`replaceState` branch so callers don't repeat it.
*
* Writes a Next.js-compatible state shape so popstate can detect non-router
* entries, ignore stale Safari-style replays, and recover the active locale
* across browser back/forward. Mirrors `Router.changeState` in
* .nextjs-ref/packages/next/src/shared/lib/router/router.ts (around L1916).
*
* @param mode push or replace
* @param fullUrl absolute URL committed to the browser (with basePath)
* @param navState router-level metadata (`url`, `as`, `options`) the popstate
*        handler needs to honour stickiness — most importantly the active
*        locale and the canonical app-relative `as` path.
*/
function updateHistory(mode, fullUrl, navState) {
	const previousKey = getRouterStateKey(window.history.state);
	const key = mode === "push" ? createHistoryKey() : previousKey ?? routerRuntimeState.currentHistoryKey ?? createHistoryKey();
	const state = {
		url: navState.url,
		as: navState.as,
		options: navState.options,
		__N: true,
		key
	};
	if (mode === "push") window.history.pushState(state, "", fullUrl);
	else window.history.replaceState(state, "", fullUrl);
	routerRuntimeState.currentHistoryKey = key;
	routerRuntimeState.lastPathnameAndSearch = window.location.pathname + window.location.search;
	routerRuntimeState.lastHash = window.location.hash;
	routerRuntimeState.routerDidNavigate = true;
}
function createHistoryKey() {
	routerRuntimeState.historyKeyCounter += 1;
	return `vinext_${routerRuntimeState.historyKeyCounter.toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}
/**
* Throw the canonical "no router instance" error used when a Pages Router
* navigation method (push/replace/back/reload/prefetch/beforePopState) is
* invoked during SSR or prerendering.
*
* Mirrors Next.js's `ServerRouter.push`/`replace`/etc. which all call
* `noRouter()` in `packages/next/src/server/render.tsx`. The error message
* matches Next.js verbatim so userland error handling and docs links work
* unchanged.
*
* Ported from Next.js: packages/next/src/server/render.tsx
* https://github.com/vercel/next.js/blob/canary/packages/next/src/server/render.tsx
*/
function throwNoRouterInstance() {
	throw new Error("No router instance found. you should only use \"next/router\" inside the client side of your app. https://nextjs.org/docs/messages/no-router-instance");
}
/**
* Shared client-side navigation flow used by both `useRouter()` and the
* `Router` singleton. The only differences between push/replace are the
* history method (`pushState` vs `replaceState`), the external-URL fallback
* (`assign` vs `replace`), and the fact that push saves scroll position for
* back/forward restoration while replace does not.
*
* `onStateUpdate` lets the hook trigger a `setState` re-render at the same
* point that hashChangeComplete/routeChangeComplete fires; the singleton
* passes no callback.
*/
async function performNavigation(url, as, options, mode, onStateUpdate) {
	if (typeof window === "undefined") throwNoRouterInstance();
	assertSafeNavigationUrl(resolveUrl(url));
	if (as !== void 0) assertSafeNavigationUrl(String(as));
	const isHydrationQueryUpdate = options?._h === 1;
	const navigationLocale = resolveTransitionLocale(options?.locale);
	const replaceInheritedLocale = as === void 0 && options?.locale !== void 0 && typeof url !== "string" && url.pathname === void 0 && (url.query !== null && typeof url.query === "object" && Object.keys(url.query).length > 0 || typeof url.search === "string" && url.search.length > 0 || typeof url.hash === "string" && url.hash.length > 0);
	let resolved = isHydrationQueryUpdate ? normalizeHydrationNavigationUrl(as ?? resolveUrl(url)) : resolveNavigationTarget(url, as, navigationLocale, replaceInheritedLocale);
	let resolvedRoute = isHydrationQueryUpdate ? normalizeHydrationNavigationUrl(resolveUrl(url)) : applyNavigationLocale(resolveUrl(url), navigationLocale, replaceInheritedLocale);
	if (as === void 0 && (typeof url === "string" && options?._vinextInterpolateDynamicRoute === true || typeof url !== "string" && url.pathname === void 0 && (url.query !== null && typeof url.query === "object" && Object.keys(url.query).length > 0 || typeof url.search === "string" && url.search.length > 0))) {
		resolved = interpolateCurrentDynamicRoute(resolved);
		resolvedRoute = interpolateCurrentDynamicRoute(resolvedRoute);
	}
	if (isExternalUrl(resolved)) {
		const localPath = toSameOriginAppPath(resolved, __basePath);
		if (localPath == null) {
			if (mode === "push") window.location.assign(resolved);
			else window.location.replace(resolved);
			return true;
		}
		resolved = localPath;
	}
	if (isExternalUrl(resolvedRoute)) {
		const localPath = toSameOriginAppPath(resolvedRoute, __basePath);
		if (localPath != null) resolvedRoute = localPath;
	}
	resolved = normalizePathTrailingSlash(resolved, __trailingSlash);
	resolvedRoute = normalizePathTrailingSlash(resolvedRoute, __trailingSlash);
	let interpolatedRoute = resolvedRoute;
	if (resolvedRoute.includes("[")) {
		const projection = interpolateDynamicRouteHref(resolvedRoute, resolved, typeof url === "string" || !url.query || typeof url.query === "string" ? void 0 : url.query);
		if (projection?.href) {
			interpolatedRoute = projection.href;
			if (as === void 0 && stripHash(resolved).split("?", 1)[0] === projection.routePathname) {
				const remaining = new URLSearchParams();
				const consumed = new Set(projection.params);
				for (const [k, v] of Object.entries(projection.query)) {
					if (consumed.has(k)) continue;
					if (v === void 0) continue;
					if (Array.isArray(v)) v.forEach((entry) => remaining.append(k, entry));
					else remaining.append(k, v);
				}
				const searchStr = remaining.toString();
				const hashStr = extractHash(resolved);
				resolved = normalizePathTrailingSlash(`${projection.href.split(/[?#]/, 1)[0]}${searchStr ? `?${searchStr}` : ""}${hashStr}`, __trailingSlash);
			}
		} else interpolatedRoute = resolved;
	}
	const full = normalizePathTrailingSlash(toBrowserNavigationHref(resolved, window.location.href, __basePath), __trailingSlash);
	const fullRouteUrl = interpolatedRoute !== resolved ? normalizePathTrailingSlash(toBrowserNavigationHref(interpolatedRoute, window.location.href, __basePath), __trailingSlash) : full;
	const errorRouteHtmlFetchUrl = resolvePagesErrorHtmlFetchUrl(url, navigationLocale);
	const htmlFetchUrl = errorRouteHtmlFetchUrl ?? getPagesHtmlFetchUrl(fullRouteUrl, navigationLocale);
	const shallow = options?.shallow ?? false;
	const doScroll = options?.scroll !== false;
	const hash = extractHash(resolved);
	const scrollTarget = doScroll ? {
		x: 0,
		y: 0
	} : null;
	const navigateOptions = errorRouteHtmlFetchUrl ? {
		allowNotFoundResponse: true,
		locale: navigationLocale,
		mode,
		scroll: scrollTarget,
		isHydrationQueryUpdate: options?._h === 1
	} : {
		locale: navigationLocale,
		mode,
		scroll: scrollTarget,
		isHydrationQueryUpdate: options?._h === 1
	};
	const currentLocale = getCurrentUrlLocale();
	if (mode === "push" && interpolatedRoute !== resolved && stripHash(full) === routerRuntimeState.lastPathnameAndSearch && navigationLocale === currentLocale) mode = "replace";
	const navStateOptions = { shallow };
	if (navigationLocale !== void 0) navStateOptions.locale = navigationLocale;
	const resolvedNoHash = stripHash(resolved);
	const navState = {
		url: stripHash(interpolatedRoute),
		as: resolvedNoHash,
		options: navStateOptions
	};
	if (options?._h !== 1 && interpolatedRoute === resolved && isHashOnlyChange(full)) {
		if (mode === "push") saveScrollPosition();
		const eventUrl = resolveHashUrl(full);
		routerEvents.emit("hashChangeStart", eventUrl, { shallow });
		updateHistory(mode, resolved.startsWith("#") ? resolved : full, navState);
		if (doScroll) scrollToHashTarget(extractHash(resolved));
		onStateUpdate?.();
		routerEvents.emit("hashChangeComplete", eventUrl, { shallow });
		dispatchNavigateEvent();
		return true;
	}
	const appPath = getLocalPathname(resolved);
	const appPathNorm = appPath !== null ? removeTrailingSlash(appPath) : null;
	const appPathEntry = appPathNorm !== null ? getPagesRouterComponentsMap()[appPathNorm] : void 0;
	if (appPathEntry !== void 0 && "__appRouter" in appPathEntry && appPathEntry.__appRouter) {
		if (mode === "push") window.location.assign(full);
		else window.location.replace(full);
		return new Promise(() => {});
	}
	const rewrites = window.__VINEXT_CLIENT_REWRITES__;
	const hybridOwner = rewrites && (rewrites.beforeFiles.length > 0 || rewrites.afterFiles.length > 0 || rewrites.fallback.length > 0) && hasClientAppRouteManifest() ? (await import("./internal/hybrid-client-route-owner.js")).resolveHybridClientRouteOwner(resolved, __basePath) : resolveDirectHybridClientRouteOwner(resolved, __basePath);
	if (["app", "document"].includes(hybridOwner ?? "")) {
		if (mode === "push") window.location.assign(full);
		else window.location.replace(full);
		return new Promise(() => {});
	}
	if (mode === "push") saveScrollPosition();
	const isQueryUpdating = options?._h === 1;
	if (!isQueryUpdating) routerEvents.emit("routeChangeStart", resolved, { shallow });
	routerEvents.emit("beforeHistoryChange", resolved, { shallow });
	updateHistory(mode, full, navState);
	if (!shallow) {
		const result = await runNavigateClient(full, resolved, htmlFetchUrl, navigateOptions, fullRouteUrl);
		if (result === "cancelled") return true;
		if (result === "failed") return false;
	} else if (doScroll) if (hash) scrollToHashTarget(hash);
	else window.scrollTo(0, 0);
	onStateUpdate?.();
	if (!isQueryUpdating) routerEvents.emit("routeChangeComplete", resolved, { shallow });
	if (doScroll && hash && !shallow) scrollToHashTarget(hash);
	dispatchNavigateEvent();
	return true;
}
/**
* Prefetch the resources needed for a future Pages Router navigation.
*
* When the client has a registered code-split loader for the target route
* (the prod hot path), we warm the page's JS chunk by invoking the loader
* thunk now. Vite's dynamic `import()` machinery is responsible for fetching
* and caching it; the returned Promise is intentionally discarded. SSG routes
* also prefetch their `/_next/data/<buildId>/<page>.json` payload, matching
* Next.js's Pages Router `_isSsg(route)` gate.
*
* When no loader is registered (dev server, or an unmapped route), we fall
* back to the legacy `<link rel="prefetch" as="document">` hint, which lets
* the browser preload the HTML document. This matches the pre-`_next/data`
* behaviour so dev doesn't regress.
*
* Ported from Next.js: `packages/next/src/client/page-loader.ts` `prefetch`
* (the data + chunk parallel prefetch shape).
*/
async function prefetchUrl(url, as) {
	if (typeof document === "undefined") return;
	const displayUrl = as ?? url;
	const dataTarget = resolvePagesDataNavigationTarget(url, __basePath);
	if (dataTarget) {
		const middlewareDataHref = displayUrl === url ? dataTarget.middlewareDataHref : getPagesMiddlewareDataHref(displayUrl, __basePath) ?? void 0;
		prefetchPagesData({
			...dataTarget,
			middlewareDataHref
		});
		return;
	}
	await markAppRouteDetectedOnPrefetch(displayUrl, __basePath);
	const link = document.createElement("link");
	link.rel = "prefetch";
	link.href = displayUrl;
	link.as = "document";
	document.head.appendChild(link);
}
/**
* useRouter hook - Pages Router compatible.
*
* Ported from Next.js: packages/next/src/client/router.ts
* https://github.com/vercel/next.js/blob/canary/packages/next/src/client/router.ts
*/
function useRouter() {
	const router = useContext(RouterContext);
	if (router) return router;
	if (typeof window !== "undefined" && window.__VINEXT_PAGE_LOADERS__ !== void 0) return singletonRouter;
	throw new Error("NextRouter was not mounted. https://nextjs.org/docs/messages/next-router-not-mounted");
}
function PagesRouterProvider({ children }) {
	const [{ pathname, query, asPath, isReady }, setState] = useState(getRouterSnapshot);
	useEffect(() => {
		const onNavigate = ((_e) => {
			setState(getRouterSnapshot());
		});
		window.addEventListener("vinext:navigate", onNavigate);
		let cancelled = false;
		const readyTimer = window.setTimeout(() => {
			if (cancelled) return;
			if (markPagesRouterReady()) {
				setState(getRouterSnapshot());
				notifyNextNavigationPagesContext();
			}
		}, 0);
		return () => {
			cancelled = true;
			window.clearTimeout(readyTimer);
			window.removeEventListener("vinext:navigate", onNavigate);
		};
	}, []);
	const router = useMemo(() => buildRouterValue(pathname, query, asPath, isReady, {
		push: singletonRouter.push,
		replace: singletonRouter.replace,
		back: singletonRouter.back,
		forward: singletonRouter.forward,
		reload: singletonRouter.reload,
		prefetch: singletonRouter.prefetch,
		beforePopState: singletonRouter.beforePopState
	}), [
		pathname,
		query,
		asPath,
		isReady
	]);
	const appRouter = useMemo(() => ({
		bfcacheId: "0",
		back() {
			singletonRouter.back();
		},
		forward() {
			if (typeof window === "undefined") throwNoRouterInstance();
			window.history.forward();
		},
		refresh() {
			singletonRouter.reload();
		},
		push(href, options) {
			singletonRouter.push(href, void 0, { scroll: options?.scroll });
		},
		replace(href, options) {
			singletonRouter.replace(href, void 0, { scroll: options?.scroll });
		},
		prefetch(href) {
			singletonRouter.prefetch(href);
		}
	}), []);
	const content = createElement(RouterContext.Provider, { value: router }, createElement(Fragment, null, children, createElement(PagesRouterHydrationMarker)));
	return AppRouterContext ? createElement(AppRouterContext.Provider, { value: appRouter }, content) : content;
}
function isNextRouterState(state) {
	return typeof state === "object" && state !== null && "__N" in state && state.__N === true && "url" in state && typeof state.url === "string" && "as" in state && typeof state.as === "string" && "options" in state && typeof state.options === "object" && state.options !== null;
}
function getRouterStateKey(state) {
	if (!isNextRouterState(state)) return void 0;
	return typeof state.key === "string" ? state.key : void 0;
}
function getTrackedPagesRouterAsPath() {
	const trackedUrl = new URL(routerRuntimeState.lastPathnameAndSearch, window.location.href);
	return removeNavigationLocalePrefix(stripBasePath(trackedUrl.pathname, __basePath) + trackedUrl.search);
}
function handlePagesRouterPopState(e) {
	const browserUrl = window.location.pathname + window.location.search;
	const appUrl = stripBasePath(window.location.pathname, __basePath) + window.location.search;
	const state = e.state;
	const wasFirst = routerRuntimeState.isFirstPopStateEvent;
	routerRuntimeState.isFirstPopStateEvent = false;
	if (state !== null && state !== void 0 && !isNextRouterState(state)) return;
	if (wasFirst && !routerRuntimeState.routerDidNavigate && isNextRouterState(state)) {
		const currentLocale = window.__VINEXT_LOCALE__;
		if (state.options?.locale === currentLocale && typeof state.as === "string" && state.as === getTrackedPagesRouterAsPath()) return;
	}
	const currentHash = window.location.hash;
	const isHashOnly = browserUrl === routerRuntimeState.lastPathnameAndSearch && (currentHash !== routerRuntimeState.lastHash || currentHash !== "");
	const targetKey = getRouterStateKey(state);
	let forcedScroll;
	if (manualScrollRestoration) {
		const currentKey = routerRuntimeState.currentHistoryKey;
		if (currentKey !== void 0 && currentKey !== targetKey) saveScrollPositionToSessionStorage(currentKey, getWindowScrollPosition());
		if (targetKey !== void 0 && currentKey !== targetKey) forcedScroll = readScrollPositionFromSessionStorage(targetKey) ?? {
			x: 0,
			y: 0
		};
	}
	if (routerRuntimeState.beforePopStateCb !== void 0) {
		const beforePopStateState = isNextRouterState(state) ? {
			url: state.url,
			as: state.as,
			options: state.options
		} : {
			url: appUrl,
			as: appUrl,
			options: { shallow: false }
		};
		if (!routerRuntimeState.beforePopStateCb({ ...beforePopStateState })) return;
	}
	if (targetKey !== void 0) routerRuntimeState.currentHistoryKey = targetKey;
	routerRuntimeState.lastPathnameAndSearch = browserUrl;
	routerRuntimeState.lastHash = currentHash;
	if (isHashOnly) {
		const hashUrl = appUrl + window.location.hash;
		routerEvents.emit("hashChangeStart", hashUrl, { shallow: false });
		scrollToHashTarget(window.location.hash);
		routerEvents.emit("hashChangeComplete", hashUrl, { shallow: false });
		dispatchNavigateEvent();
		return;
	}
	const stateLocale = isNextRouterState(state) ? state.options?.locale : void 0;
	const effectiveLocale = typeof stateLocale === "string" ? stateLocale : window.__VINEXT_LOCALE__;
	const fullAppUrl = appUrl + window.location.hash;
	routerEvents.emit("routeChangeStart", fullAppUrl, { shallow: false });
	routerEvents.emit("beforeHistoryChange", fullAppUrl, { shallow: false });
	(async () => {
		const scrollTarget = manualScrollRestoration ? forcedScroll ?? readScrollPosition(state) ?? {
			x: 0,
			y: 0
		} : readScrollPosition(state);
		const stateRouteUrl = (() => {
			if (isNextRouterState(state) && typeof state.url === "string" && typeof state.as === "string" && state.url !== state.as) return normalizePathTrailingSlash(withBasePath(state.url, __basePath), __trailingSlash);
			return browserUrl;
		})();
		if (await runNavigateClient(browserUrl, fullAppUrl, getPagesHtmlFetchUrl(stateRouteUrl, effectiveLocale), { scroll: scrollTarget }, stateRouteUrl) === "completed") {
			routerEvents.emit("routeChangeComplete", fullAppUrl, { shallow: false });
			dispatchNavigateEvent();
		}
	})();
}
setPagesRouterPopStateHandler(handlePagesRouterPopState);
/**
* Wrap a React element in a RouterContext.Provider so that
* next/compat/router's useRouter() returns the real Pages Router value.
*
* The provider owns the reactive Pages Router snapshot so next/router and
* next/compat/router consumers share one context value instead of each hook
* installing its own global URL-change listener.
*
* The PagesRouterCommitBoundary exists for client navigations: its layout
* callback runs scroll restoration at commit time and resolves the navigation
* at the same root-commit boundary Next.js awaits before routeChangeComplete.
* Its onError rejection drives the hard-navigation fallback in runNavigateClient.
* The same boundary intentionally also wraps SSR and initial hydration, where
* callbacks default to noopCommit: a hydration-time render error is caught
* here (React still console.error's it) instead of propagating, matching the
* navigation-path containment.
*/
function wrapWithRouterContext(element, onCommit = noopCommit, onError = noopCommit) {
	const { CommitBoundary, Provider } = getPagesRouterRuntimeComponents();
	let inner = createElement(Provider, null, element);
	if (typeof window !== "undefined" && window.__VINEXT_REACT_STRICT_MODE__ === true) inner = createElement(StrictMode, null, inner);
	return createElement(CommitBoundary, {
		onCommit,
		onError
	}, inner);
}
/**
* Higher-order component that injects the Pages Router `router` instance as
* a `router` prop into a wrapped component. Primarily used by class
* components (which cannot call hooks) to access the router. The wrapped
* component receives the same props as the original, minus `router`, which
* is filled in by the HOC.
*
* Ported from Next.js: packages/next/src/client/with-router.tsx
* https://github.com/vercel/next.js/blob/canary/packages/next/src/client/with-router.tsx
*
* Differences from Next.js:
* - We type the composed component as `ComponentType<P>` instead of
*   `NextComponentType<C, any, P>` because vinext does not expose
*   `NextComponentType` from this shim. The runtime shape (and the props
*   the wrapper forwards) is identical.
* - We forward `getInitialProps` and `origGetInitialProps` from the
*   composed component so `_app` parity holds for class components that
*   define `getInitialProps`.
*/
function withRouter(ComposedComponent) {
	function WithRouterWrapper(props) {
		return createElement(ComposedComponent, {
			router: useRouter(),
			...props
		});
	}
	const composed = ComposedComponent;
	WithRouterWrapper.getInitialProps = composed.getInitialProps;
	WithRouterWrapper.origGetInitialProps = composed.origGetInitialProps;
	if (process.env.NODE_ENV !== "production") WithRouterWrapper.displayName = `withRouter(${composed.displayName || composed.name || "Unknown"})`;
	return WithRouterWrapper;
}
const RouterMethods = {
	router: null,
	readyCallbacks: [],
	ready(callback) {
		callback();
	},
	/** See `_components` comment above for the dual role this map plays. */
	components: getPagesRouterComponentsMap(),
	sdc: getPagesStaticDataCache(),
	push: (url, as, options) => {
		if (typeof window === "undefined") throwNoRouterInstance();
		assertSafeNavigationUrl(resolveUrl(url));
		if (as !== void 0) assertSafeNavigationUrl(String(as));
		return performNavigation(url, as, options, "push");
	},
	replace: (url, as, options) => {
		if (typeof window === "undefined") throwNoRouterInstance();
		assertSafeNavigationUrl(resolveUrl(url));
		if (as !== void 0) assertSafeNavigationUrl(String(as));
		return performNavigation(url, as, options, "replace");
	},
	back: () => {
		if (typeof window === "undefined") throwNoRouterInstance();
		window.history.back();
	},
	forward: () => {
		if (typeof window === "undefined") throwNoRouterInstance();
		window.history.forward();
	},
	reload: () => {
		if (typeof window === "undefined") throwNoRouterInstance();
		window.location.reload();
	},
	prefetch: (url, as) => {
		if (typeof window === "undefined") throwNoRouterInstance();
		return prefetchUrl(url, as);
	},
	beforePopState: (cb) => {
		if (typeof window === "undefined") throwNoRouterInstance();
		routerRuntimeState.beforePopStateCb = cb;
	},
	events: routerEvents
};
const singletonRouter = Object.defineProperties(RouterMethods, {
	pathname: {
		enumerable: true,
		get() {
			return getPathnameAndQuery().pathname;
		}
	},
	route: {
		enumerable: true,
		get() {
			const { pathname } = getPathnameAndQuery();
			if (typeof window === "undefined") return pathname;
			return window.__NEXT_DATA__?.page ?? pathname;
		}
	},
	query: {
		enumerable: true,
		get() {
			return getPathnameAndQuery().query;
		}
	},
	asPath: {
		enumerable: true,
		get() {
			return getPathnameAndQuery().asPath;
		}
	},
	basePath: {
		enumerable: true,
		value: __basePath,
		writable: false
	},
	locale: {
		enumerable: true,
		get() {
			if (typeof window === "undefined") return _getSSRContext()?.locale;
			return window.__VINEXT_LOCALE__;
		}
	},
	locales: {
		enumerable: true,
		get() {
			if (typeof window === "undefined") return _getSSRContext()?.locales;
			return window.__VINEXT_LOCALES__;
		}
	},
	defaultLocale: {
		enumerable: true,
		get() {
			if (typeof window === "undefined") return _getSSRContext()?.defaultLocale;
			return window.__VINEXT_DEFAULT_LOCALE__;
		}
	},
	domainLocales: {
		enumerable: true,
		get() {
			if (typeof window === "undefined") return _getSSRContext()?.domainLocales;
			return window.__NEXT_DATA__?.domainLocales;
		}
	},
	isLocaleDomain: {
		enumerable: true,
		get() {
			const domainLocales = typeof window === "undefined" ? _getSSRContext()?.domainLocales : window.__NEXT_DATA__?.domainLocales;
			if (!domainLocales || typeof window === "undefined") return false;
			return domainLocales.some((domain) => domain.domain === window.location.hostname);
		}
	},
	isReady: {
		enumerable: true,
		get() {
			return isPagesRouterReady() && (typeof window === "undefined" || window.__NEXT_HYDRATED === true);
		}
	},
	isPreview: {
		enumerable: true,
		get() {
			if (typeof window === "undefined") return _getSSRContext()?.isPreview === true;
			return window.__NEXT_DATA__?.isPreview === true;
		}
	},
	isFallback: {
		enumerable: true,
		get() {
			if (typeof window === "undefined") return _getSSRContext()?.isFallback === true;
			return window.__NEXT_DATA__?.isFallback === true;
		}
	}
});
routerRuntimeState.publicRouter = singletonRouter;
const deprecatedRouterEvents = [
	"routeChangeStart",
	"beforeHistoryChange",
	"routeChangeComplete",
	"routeChangeError",
	"hashChangeStart",
	"hashChangeComplete"
];
if (!routerRuntimeState.deprecatedEventBridgeInstalled) {
	routerRuntimeState.deprecatedEventBridgeInstalled = true;
	for (const event of deprecatedRouterEvents) {
		const eventField = `on${event.charAt(0).toUpperCase()}${event.substring(1)}`;
		routerEvents.on(event, (...args) => {
			const handler = (routerRuntimeState.publicRouter ?? singletonRouter)[eventField];
			if (typeof handler === "function") try {
				handler(...args);
			} catch (err) {
				console.error(`Error when running the Router event: ${eventField}`);
				console.error(err instanceof Error ? `${err.message}\n${err.stack}` : String(err));
			}
		});
	}
}
if (typeof window !== "undefined") {
	installPagesRouterRuntime();
	installWindowNext({ router: singletonRouter });
}
const _PAGES_NAVIGATION_ACCESSOR_KEY = Symbol.for("vinext.navigation.pagesNavigationContextAccessor");
globalThis[_PAGES_NAVIGATION_ACCESSOR_KEY] = getPagesNavigationContext;
/**
* Constructible named export matching `next/router`'s Router class surface.
* Vinext owns one browser history runtime, so instances delegate to that
* shared runtime while preserving the class/static-events API used by apps.
*/
var Router = class {
	static events = routerEvents;
	constructor(..._args) {}
	get route() {
		return singletonRouter.route;
	}
	get pathname() {
		return singletonRouter.pathname;
	}
	get query() {
		return singletonRouter.query;
	}
	get asPath() {
		return singletonRouter.asPath;
	}
	get basePath() {
		return singletonRouter.basePath;
	}
	get locale() {
		return singletonRouter.locale;
	}
	get locales() {
		return singletonRouter.locales;
	}
	get defaultLocale() {
		return singletonRouter.defaultLocale;
	}
	get domainLocales() {
		return singletonRouter.domainLocales;
	}
	get isLocaleDomain() {
		return singletonRouter.isLocaleDomain;
	}
	get isReady() {
		return singletonRouter.isReady;
	}
	get isPreview() {
		return singletonRouter.isPreview;
	}
	get isFallback() {
		return singletonRouter.isFallback;
	}
	get events() {
		return singletonRouter.events;
	}
	get components() {
		return singletonRouter.components;
	}
	get sdc() {
		return singletonRouter.sdc;
	}
	push(url, as, options) {
		return singletonRouter.push(url, as, options);
	}
	replace(url, as, options) {
		return singletonRouter.replace(url, as, options);
	}
	reload() {
		singletonRouter.reload();
	}
	back() {
		singletonRouter.back();
	}
	forward() {
		singletonRouter.forward();
	}
	prefetch(url, as) {
		return singletonRouter.prefetch(url, as);
	}
	beforePopState(cb) {
		singletonRouter.beforePopState(cb);
	}
};
//#endregion
export { Router, initializePagesRouterReadyFromNextData as _initializePagesRouterReadyFromNextData, markPagesRouterReady as _markPagesRouterReady, _registerRouterStateAccessors, applyNavigationLocale, singletonRouter as default, getPagesNavigationContext, getPagesNavigationIsReadyFromSerializedState, isExternalUrl, isHashOnlyChange, setSSRContext, useRouter, withRouter, wrapWithRouterContext };
