import { VINEXT_CLIENT_REUSE_MANIFEST_HEADER, VINEXT_PARAMS_HEADER, VINEXT_RSC_REDIRECT_HEADER, VINEXT_RSC_REDIRECT_TYPE_HEADER } from "./headers.js";
import { AppElementsWire } from "./app-elements-wire.js";
import { getMountedSlotIdsHeader, resolveVisitedResponseInterceptionContext } from "./app-elements.js";
import { AppRouterContext } from "../shims/internal/app-router-context.js";
import { installWindowNext, setWindowNextInternalSourcePage } from "../client/window-next.js";
import { retryScrollTo, scrollToHashTargetOnNextFrame } from "../shims/hash-scroll.js";
import { getBfcacheIdMapContext, setNavigationContext } from "../shims/navigation-context-state.js";
import { decodeRedirectError, isRedirectError } from "../shims/navigation-errors.js";
import DefaultGlobalError from "../shims/default-global-error.js";
import { clearAppNavigationFailureTarget, installAppNavigationFailureListeners } from "../client/app-nav-failure-handler.js";
import { DevRecoveryBoundary, GlobalErrorBoundary, RedirectBoundary } from "../shims/error-boundary.js";
import { beginAppRouterScrollIntent, consumeAppRouterScrollIntent } from "../shims/app-router-scroll-state.js";
import { AppRouterScrollCommitProvider } from "../shims/app-router-scroll.js";
import { BfcacheStateKeyMapContext, ElementsContext, Slot } from "../shims/slot.js";
import { VINEXT_RSC_COMPATIBILITY_ID_HEADER, VINEXT_RSC_CONTENT_TYPE, createRscRequestHeaders, createRscRequestUrl, getVinextRscCompatibilityId, stripRscCacheBustingSearchParam } from "./app-rsc-cache-busting.js";
import { getNavigationRuntime, registerNavigationRuntimeBootstrap, registerNavigationRuntimeFunctions } from "../client/navigation-runtime.js";
import { notifyAppRouterTransitionStart } from "../client/instrumentation-client-state.js";
import "../client/instrumentation-client.js";
import { createBfcacheSegmentStateKeyMap, createInitialBfcacheIdMap } from "./app-bfcache-identity.js";
import { createDiscardedServerActionRefreshScheduler, createServerActionInitiationSnapshot, resolveServerActionOperationLane } from "./app-browser-action-result.js";
import { createClientReuseManifestHeaderFromVisibleAppState } from "./app-browser-client-reuse-manifest.js";
import { resolveManifestNavigationInterceptionContext, resolveMiddlewareRewriteNavigationInterceptionContext } from "./app-browser-interception-context.js";
import { readHistoryStatePreviousNextUrl } from "./app-history-state.js";
import { AppBrowserMpaNavigationScheduler } from "./app-browser-mpa-navigation.js";
import { blockDangerousStreamedRscRedirect } from "./app-browser-rsc-redirect.js";
import { navigationPlanner } from "./navigation-planner.js";
import { DYNAMIC_NAVIGATION_CACHE_TTL, PREFETCH_CACHE_TTL, __basePath, appRouterInstance, commitClientNavigationState, consumePrefetchResponseForNavigation, createCachedRscResponseSnapshot, createClientNavigationRenderSnapshot, createSnapshotPathAndSearch, deletePrefetchResponseSnapshot, getClientNavigationRenderContext, getMountedSlotsHeader, getPrefetchCache, hasPrefetchCacheEntryForNavigation, invalidatePrefetchCache, preloadHybridClientRouteOwner, pushHistoryStateWithoutNotify, replaceClientParamsWithoutNotify, replaceHistoryStateWithoutNotify, resolveLoadedHybridClientRewriteHref, resolvePrefetchCacheEntryMountedSlotsHeader, restoreRscResponse, saveScrollPosition, seedPrefetchResponseSnapshot, setClientParams, setMountedSlotsHeader, setPendingPathname, useRouter } from "../shims/navigation.js";
import { chunksToReadableStream, createProgressiveRscStream, getVinextBrowserGlobal } from "./app-browser-stream.js";
import { COMMITTED_CACHE_APP_NAVIGATION_PAYLOAD_ORIGIN, FRESH_APP_NAVIGATION_PAYLOAD_ORIGIN, VISITED_CACHE_APP_NAVIGATION_PAYLOAD_ORIGIN, isCacheRestorableAppPayloadMetadata, isCompleteAppPayloadMetadata, resolveInterceptionContextFromPreviousNextUrl } from "./app-browser-state.js";
import { clearHardNavigationLoopGuard, createAppBrowserNavigationController, createBasePathStrippedPathAndSearch } from "./app-browser-navigation-controller.js";
import { consumeInitialFormState, createVinextHydrateRootOptions, hydrateRootInTransition } from "./app-browser-hydration.js";
import { AppBrowserHistoryController } from "./app-browser-history-controller.js";
import { createVisitedResponseCacheEntry, isVisitedResponseCacheEntryFresh } from "./app-visited-response-cache.js";
import { createPopstateRestoreHandler, restoreSynchronousPopstateScrollPosition } from "./app-browser-popstate.js";
import { createDevOnCaughtError, createOnUncaughtError, createProdOnCaughtError, prodOnRecoverableError } from "./app-browser-error.js";
import { createHydrationCachePublication } from "./app-hydration-cache-publication.js";
import { createOptimisticRouteTemplate, getOptimisticPrefetchSourceKey, getOptimisticRouteTemplateKey, resolveOptimisticNavigationPayload } from "./app-optimistic-routing.js";
import { removeStylesheetLinksCoveredByInlineCss } from "./app-inline-css-client.js";
import { createElement, startTransition, use, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { createRoot, hydrateRoot } from "react-dom/client";
import { createFromFetch, createFromReadableStream, setServerCallback } from "@vitejs/plugin-rsc/browser";
import { hasServerActions, loadServerActionClient } from "virtual:vinext-app-capabilities";
//#region src/server/app-browser-entry.ts
const HAS_CLIENT_REWRITES = process.env.__VINEXT_HAS_CLIENT_REWRITES !== "false";
function toActionType(kind) {
	return kind === "traverse" ? "traverse" : "navigate";
}
function toOperationLane(kind) {
	switch (kind) {
		case "navigate": return "navigation";
		case "refresh": return "refresh";
		case "traverse": return "traverse";
		default: throw new Error("[vinext] Unknown navigation kind: " + String(kind));
	}
}
const MAX_VISITED_RESPONSE_CACHE_SIZE = 50;
const CLIENT_RSC_COMPATIBILITY_ID = getVinextRscCompatibilityId();
const optimisticRouteTemplates = /* @__PURE__ */ new Map();
const optimisticRouteTemplateSources = /* @__PURE__ */ new Set();
const optimisticRouteTemplateLearning = /* @__PURE__ */ new Map();
function claimInitialAppRouterBootstrap() {
	if (window.__VINEXT_RSC_ROOT__ || window.__VINEXT_RSC_BOOTSTRAP_STATE__) return false;
	window.__VINEXT_RSC_BOOTSTRAP_STATE__ = "starting";
	return true;
}
function markInitialAppRouterBootstrapHydrated() {
	window.__VINEXT_RSC_BOOTSTRAP_STATE__ = "hydrated";
}
function getBrowserRouteManifest() {
	return getNavigationRuntime()?.bootstrap.routeManifest ?? null;
}
const historyController = new AppBrowserHistoryController({
	initialHistoryState: window.history.state,
	maxHistoryStateSnapshots: 50,
	readHistoryState: () => window.history.state,
	readCurrentHref: () => window.location.href,
	pushHistoryState: (state, href) => pushHistoryStateWithoutNotify(state, "", href),
	replaceHistoryState: (state, href) => replaceHistoryStateWithoutNotify(state, "", href),
	readVisibleNavigationMetadata: () => {
		if (!hasBrowserRouterState()) return null;
		const routerState = getBrowserRouterState();
		return {
			bfcacheIds: routerState.bfcacheIds,
			previousNextUrl: routerState.previousNextUrl
		};
	}
});
const browserNavigationController = createAppBrowserNavigationController({
	basePath: __basePath,
	getRouteManifest: getBrowserRouteManifest,
	syncHistoryStatePreviousNextUrl: (previousNextUrl, bfcacheIds) => historyController.syncCurrentHistoryStatePreviousNextUrl(previousNextUrl, bfcacheIds)
});
const discardedServerActionRefreshScheduler = hasServerActions ? createDiscardedServerActionRefreshScheduler({ runRefresh() {
	clearClientNavigationCaches();
	getNavigationRuntime()?.functions.navigate?.(window.location.href, 0, "refresh", void 0, void 0, true);
} }) : {
	markNavigationSettled() {},
	markNavigationStart() {},
	schedule() {}
};
const NavigationCommitSignal = browserNavigationController.NavigationCommitSignal;
const ACTION_HTTP_FALLBACK_ROBOTS_META_ATTR = "data-vinext-action-http-fallback";
function syncServerActionHttpFallbackHead(status) {
	document.head.querySelectorAll(`meta[${ACTION_HTTP_FALLBACK_ROBOTS_META_ATTR}="robots"]`).forEach((node) => node.remove());
	if (status !== 404) return;
	const robots = document.createElement("meta");
	robots.name = "robots";
	robots.content = "noindex";
	robots.setAttribute(ACTION_HTTP_FALLBACK_ROBOTS_META_ATTR, "robots");
	document.head.appendChild(robots);
}
const BfcacheIdMapContext = getBfcacheIdMapContext();
function parseEncodedJsonHeader(value) {
	if (!value) return null;
	try {
		return JSON.parse(decodeURIComponent(value));
	} catch {
		return null;
	}
}
function isRouterStatePromise(value) {
	return value instanceof Promise;
}
let latestClientParams = {};
const visitedResponseCache = /* @__PURE__ */ new Map();
let clientNavigationCacheGeneration = 0;
let browserRouterStateHasEverCommitted = false;
const mpaNavigationScheduler = new AppBrowserMpaNavigationScheduler();
const unresolvedMpaNavigation = new Promise(() => {});
const RSC_HMR_SETTLE_DELAY_MS = 150;
const DEFAULT_GLOBAL_ERROR_COMPONENT = DefaultGlobalError;
let latestRscHmrUpdateId = 0;
let synchronousPopstateScrollRestoreNavigationId = null;
function waitForRscHmrSettle(delayMs = RSC_HMR_SETTLE_DELAY_MS) {
	return new Promise((resolve) => {
		window.setTimeout(resolve, delayMs);
	});
}
function restoreHistoryStateSnapshot(historyState, navId, onApprovedBeforeCommit) {
	let restored = false;
	flushSync(() => {
		restored = historyController.restoreHistorySnapshot({
			historyState,
			stageClientParams,
			approveVisibleRestore: ({ state, beforeCommit }) => browserNavigationController.restoreHistorySnapshotVisibleState({
				beforeCommit: () => {
					onApprovedBeforeCommit?.();
					beforeCommit();
				},
				navId,
				state,
				targetHref: window.location.href
			})
		});
	});
	if (!restored) return false;
	commitClientNavigationState(navId, { releaseSnapshot: false });
	return true;
}
function getBrowserRouterState() {
	return browserNavigationController.getBrowserRouterState();
}
function hasBrowserRouterState() {
	return browserNavigationController.hasBrowserRouterState();
}
function waitForBrowserRouterStateReady() {
	return browserNavigationController.waitForBrowserRouterStateReady();
}
function beginPendingBrowserRouterState() {
	return browserNavigationController.beginPendingBrowserRouterState();
}
function applyClientParams(params) {
	latestClientParams = params;
	setClientParams(params);
}
function stageClientParams(params) {
	latestClientParams = params;
	replaceClientParamsWithoutNotify(params);
}
function clearVisitedResponseCache() {
	visitedResponseCache.clear();
}
function clearPrefetchState() {
	invalidatePrefetchCache();
	optimisticRouteTemplates.clear();
	optimisticRouteTemplateSources.clear();
	optimisticRouteTemplateLearning.clear();
}
function clearClientNavigationCaches() {
	clientNavigationCacheGeneration += 1;
	clearVisitedResponseCache();
	clearPrefetchState();
	historyController.invalidateRestorableClientState();
}
function normalizeBrowserRscUrlForReuse(url) {
	if (!url) return null;
	try {
		const parsed = new URL(url, window.location.origin);
		stripRscCacheBustingSearchParam(parsed);
		return `${parsed.pathname}${parsed.search}`;
	} catch {
		return null;
	}
}
function isAlternatePrefetchResponseUrl(responseUrl, additionalRscUrls) {
	const normalizedResponseUrl = normalizeBrowserRscUrlForReuse(responseUrl);
	if (normalizedResponseUrl === null) return false;
	return additionalRscUrls.some((additionalRscUrl) => normalizeBrowserRscUrlForReuse(additionalRscUrl) === normalizedResponseUrl);
}
function isSettledPrefetchCacheEntry(entry) {
	return entry.outcome === "cache-seeded" && entry.pending === void 0 && entry.snapshot !== void 0;
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
async function learnOptimisticRouteTemplateFromPrefetch(options) {
	const source = parsePrefetchCacheKey(options.cacheKey);
	if (source.interceptionContext !== options.interceptionContext) return false;
	if (resolvePrefetchCacheEntryMountedSlotsHeader(options.entry) !== options.mountedSlotsHeader) return false;
	if (options.interceptionContext !== null) return false;
	const elements = await decodeAppElementsPromise(createFromFetch(Promise.resolve(restoreRscResponse(options.entry.snapshot))));
	const template = createOptimisticRouteTemplate({
		allowLoadingShell: options.entry.optimisticRouteShell === true,
		basePath: __basePath,
		elements,
		href: options.entry.snapshot.url || source.rscUrl,
		interceptionContext: options.interceptionContext,
		mountedSlotsHeader: options.mountedSlotsHeader,
		routeManifest: options.routeManifest
	});
	if (template === null) return false;
	optimisticRouteTemplates.set(getOptimisticRouteTemplateKey({
		interceptionContext: options.interceptionContext,
		mountedSlotsHeader: options.mountedSlotsHeader,
		routeId: template.routeId
	}), template);
	return true;
}
async function learnOptimisticRouteTemplatesFromPrefetchCache(options) {
	if (options.routeManifest === null) return;
	const learning = [...optimisticRouteTemplateLearning.values()];
	for (const [cacheKey, entry] of getPrefetchCache()) {
		const sourceKey = getOptimisticPrefetchSourceKey({
			cacheKey,
			interceptionContext: options.interceptionContext,
			mountedSlotsHeader: options.mountedSlotsHeader
		});
		if (optimisticRouteTemplateSources.has(sourceKey)) continue;
		if (optimisticRouteTemplateLearning.has(sourceKey)) continue;
		if (!isSettledPrefetchCacheEntry(entry)) continue;
		if (entry.prefetchKind === "route-tree") continue;
		const promise = learnOptimisticRouteTemplateFromPrefetch({
			cacheKey,
			entry,
			interceptionContext: options.interceptionContext,
			mountedSlotsHeader: options.mountedSlotsHeader,
			routeManifest: options.routeManifest
		}).then((learned) => {
			if (learned) optimisticRouteTemplateSources.add(sourceKey);
		}).finally(() => {
			optimisticRouteTemplateLearning.delete(sourceKey);
		});
		optimisticRouteTemplateLearning.set(sourceKey, promise);
		learning.push(promise);
	}
	if (learning.length === 0) return;
	await Promise.allSettled(learning);
}
function createActionInitiationSnapshot() {
	const routerState = getBrowserRouterState();
	return createServerActionInitiationSnapshot({
		href: window.location.href,
		navigationId: browserNavigationController.getActiveNavigationId(),
		routerState
	});
}
function createNavigationCommitEffect(options) {
	const { bfcacheIds, href, historyUpdateMode, navId, params, previousNextUrl, targetHistoryIndex } = options;
	return () => {
		if (!browserNavigationController.isCurrentNavigation(navId)) {
			commitClientNavigationState(void 0, { releaseSnapshot: true });
			return;
		}
		historyController.commitNavigationHistory({
			bfcacheIds,
			href,
			historyUpdateMode,
			previousNextUrl,
			stageClientParams: () => stageClientParams(params),
			targetHistoryIndex
		});
		clearAppNavigationFailureTarget(href);
		commitClientNavigationState(navId);
	};
}
async function renderNavigationPayload(payload, navigationSnapshot, targetHref, navId, historyUpdateMode, params, previousNextUrl, pendingRouterState, payloadOrigin, actionType = "navigate", operationLane = "navigation", traversalIntent = null, scrollIntent = null, restoredBfcacheIds = null, reuseCurrentBfcacheIds = true, visibleCommitMode = "transition", onCommittedState, navigationCommitKind) {
	syncServerActionHttpFallbackHead(null);
	return browserNavigationController.renderNavigationPayload({
		actionType,
		createNavigationCommitEffect,
		historyUpdateMode,
		navigationSnapshot,
		nextElements: payload,
		operationLane,
		payloadOrigin,
		params,
		pendingRouterState,
		previousNextUrl,
		scrollIntent,
		restoredBfcacheIds,
		reuseCurrentBfcacheIds,
		targetHistoryIndex: traversalIntent === null ? void 0 : traversalIntent.targetHistoryIndex,
		targetHref,
		navId,
		navigationCommitKind,
		visibleCommitMode,
		onCommittedState
	});
}
async function commitSameUrlNavigatePayload(nextElements, actionInitiation, returnValue, revalidation = "none") {
	const navigationSnapshot = createClientNavigationRenderSnapshot(actionInitiation.href, actionInitiation.routerState.navigationSnapshot.params);
	return browserNavigationController.commitSameUrlNavigatePayload(nextElements, navigationSnapshot, returnValue, actionInitiation.routerState, {
		onDiscardedRevalidation() {
			discardedServerActionRefreshScheduler.schedule();
		},
		revalidation,
		startedNavigationId: actionInitiation.navigationId,
		targetHref: actionInitiation.href
	});
}
function evictVisitedResponseCacheIfNeeded() {
	while (visitedResponseCache.size >= MAX_VISITED_RESPONSE_CACHE_SIZE) {
		const oldest = visitedResponseCache.keys().next().value;
		if (oldest === void 0) return;
		visitedResponseCache.delete(oldest);
	}
}
function readVisitedResponseCacheCandidate(rscUrl, interceptionContext, mountedSlotsHeader, navigationKind) {
	const cacheKey = AppElementsWire.encodeCacheKey(rscUrl, interceptionContext);
	const cached = visitedResponseCache.get(cacheKey);
	if (!cached) return {
		cacheKey,
		entry: null,
		facts: {
			candidate: "missing",
			navigationKind
		}
	};
	return {
		cacheKey,
		entry: cached,
		facts: {
			candidate: "present",
			fresh: isVisitedResponseCacheEntryFresh(cached, {
				navigationKind,
				now: Date.now()
			}),
			mountedSlotsMatch: cached.mountedSlotsHeader === mountedSlotsHeader,
			navigationKind
		}
	};
}
function applyVisitedResponseCacheCandidateDecision(candidate, decision) {
	if (candidate.entry === null) return null;
	if (decision.kind === "reuse") {
		visitedResponseCache.delete(candidate.cacheKey);
		visitedResponseCache.set(candidate.cacheKey, candidate.entry);
		return candidate.entry;
	}
	visitedResponseCache.delete(candidate.cacheKey);
	return null;
}
function deleteVisitedResponse(rscUrl, interceptionContext) {
	visitedResponseCache.delete(AppElementsWire.encodeCacheKey(rscUrl, interceptionContext));
}
function storeVisitedResponseSnapshot(rscUrl, interceptionContext, snapshot, params, prefetchFallbackTtlMs = DYNAMIC_NAVIGATION_CACHE_TTL, requestMountedSlotsHeader = snapshot.mountedSlotsHeader ?? null, elements) {
	const cacheKey = AppElementsWire.encodeCacheKey(rscUrl, interceptionContext);
	visitedResponseCache.delete(cacheKey);
	evictVisitedResponseCacheIfNeeded();
	const entry = createVisitedResponseCacheEntry({
		fallbackTtlMs: prefetchFallbackTtlMs,
		elements,
		now: Date.now(),
		mountedSlotsHeader: requestMountedSlotsHeader,
		params,
		response: snapshot
	});
	visitedResponseCache.set(cacheKey, entry);
	seedPrefetchResponseSnapshot(rscUrl, snapshot, interceptionContext, requestMountedSlotsHeader, prefetchFallbackTtlMs);
	return () => {
		if (visitedResponseCache.get(cacheKey) === entry) visitedResponseCache.delete(cacheKey);
		deletePrefetchResponseSnapshot(rscUrl, snapshot, interceptionContext);
	};
}
function clientNavigationSnapshotHref(snapshot) {
	return `${window.location.origin}${createSnapshotPathAndSearch(snapshot)}`;
}
function getCurrentMatchedRoutePathname() {
	const routeKey = AppElementsWire.parseElementKey(getBrowserRouterState().routeId);
	return routeKey?.kind === "route" ? routeKey.path : null;
}
function getRequestState(navigationKind, targetPathname, previousNextUrlOverride, traverseHistoryState) {
	if (previousNextUrlOverride !== void 0) return {
		interceptionContext: resolveInterceptionContextFromPreviousNextUrl(previousNextUrlOverride, __basePath),
		previousNextUrl: previousNextUrlOverride
	};
	switch (navigationKind) {
		case "navigate": {
			const currentPreviousNextUrl = getBrowserRouterState().previousNextUrl;
			if (currentPreviousNextUrl !== null) return {
				interceptionContext: resolveInterceptionContextFromPreviousNextUrl(currentPreviousNextUrl, __basePath),
				previousNextUrl: currentPreviousNextUrl
			};
			const manifestInterceptionContext = resolveManifestNavigationInterceptionContext({
				basePath: __basePath,
				currentPathname: window.location.pathname,
				routeManifest: getBrowserRouteManifest(),
				targetPathname
			});
			if (manifestInterceptionContext !== null) return {
				interceptionContext: manifestInterceptionContext,
				previousNextUrl: window.location.pathname + window.location.search
			};
			const middlewareRewriteInterceptionContext = resolveMiddlewareRewriteNavigationInterceptionContext({
				basePath: __basePath,
				currentMatchedPathname: getCurrentMatchedRoutePathname(),
				currentPathname: window.location.pathname,
				routeManifest: getBrowserRouteManifest(),
				targetPathname
			});
			if (middlewareRewriteInterceptionContext !== null) return {
				interceptionContext: middlewareRewriteInterceptionContext,
				previousNextUrl: window.location.pathname + window.location.search
			};
			return {
				interceptionContext: null,
				previousNextUrl: null
			};
		}
		case "traverse": {
			const previousNextUrl = readHistoryStatePreviousNextUrl(traverseHistoryState ?? window.history.state);
			return {
				interceptionContext: resolveInterceptionContextFromPreviousNextUrl(previousNextUrl, __basePath),
				previousNextUrl
			};
		}
		case "refresh": {
			const currentPreviousNextUrl = getBrowserRouterState().previousNextUrl;
			return {
				interceptionContext: resolveInterceptionContextFromPreviousNextUrl(currentPreviousNextUrl, __basePath),
				previousNextUrl: currentPreviousNextUrl
			};
		}
		default: throw new Error("[vinext] Unknown navigation kind: " + String(navigationKind));
	}
}
function handleDevRecoveryBoundaryCatch(resetKey) {
	browserNavigationController.drainPrePaintEffects(resetKey);
}
function isMpaNavigationState(value) {
	return value !== null && typeof value === "object" && "kind" in value && value.kind === "mpa-navigation";
}
function performMpaNavigation(href, historyUpdateMode) {
	mpaNavigationScheduler.navigate(window, href, historyUpdateMode);
}
function AppRouterRedirectBridge({ children }) {
	const router = useRouter();
	useEffect(() => {
		const handleUnhandledRedirect = (event) => {
			const error = "reason" in event ? event.reason : event.error;
			if (!isRedirectError(error)) return;
			const result = decodeRedirectError(error.digest);
			if (!result) return;
			event.preventDefault();
			startTransition(() => {
				if (result.type === "push") router.push(result.url);
				else router.replace(result.url);
			});
		};
		window.addEventListener("error", handleUnhandledRedirect);
		window.addEventListener("unhandledrejection", handleUnhandledRedirect);
		return () => {
			window.removeEventListener("error", handleUnhandledRedirect);
			window.removeEventListener("unhandledrejection", handleUnhandledRedirect);
		};
	}, [router]);
	return children ?? null;
}
function decodeAppElementsPromise(payload) {
	return Promise.resolve(payload).then((elements) => AppElementsWire.decode(elements));
}
function BrowserRoot({ hydrationCachePublication, initialElements, initialNavigationSnapshot }) {
	const resolvedElements = use(initialElements);
	const initialMetadata = AppElementsWire.readMetadata(resolvedElements);
	const [treeStateValue, setTreeStateValue] = useState(() => ({
		activeOperation: null,
		bfcacheIds: createInitialBfcacheIdMap(resolvedElements),
		elements: resolvedElements,
		interception: initialMetadata.interception,
		interceptionContext: initialMetadata.interceptionContext,
		layoutIds: initialMetadata.layoutIds,
		layoutFlags: initialMetadata.layoutFlags,
		navigationSnapshot: initialNavigationSnapshot,
		previousNextUrl: null,
		renderId: 0,
		rootLayoutTreePath: initialMetadata.rootLayoutTreePath,
		routeId: initialMetadata.routeId,
		slotBindings: initialMetadata.slotBindings,
		visibleCommitVersion: 0
	}));
	if (isMpaNavigationState(treeStateValue)) {
		performMpaNavigation(treeStateValue.href, treeStateValue.historyUpdateMode);
		throw unresolvedMpaNavigation;
	}
	const treeState = isRouterStatePromise(treeStateValue) ? use(treeStateValue) : treeStateValue;
	const stateRef = useRef(treeState);
	stateRef.current = treeState;
	useLayoutEffect(() => {
		const setAppRouterStateValue = (value) => {
			setTreeStateValue(value);
		};
		const detach = browserNavigationController.attachBrowserRouterState(setAppRouterStateValue, stateRef);
		registerNavigationRuntimeFunctions({ navigateExternal: (href, historyUpdateMode) => {
			setTreeStateValue({
				href,
				historyUpdateMode,
				kind: "mpa-navigation"
			});
			return new Promise(() => {});
		} });
		browserRouterStateHasEverCommitted = true;
		hydrationCachePublication.commit();
		return () => {
			hydrationCachePublication.invalidate();
			registerNavigationRuntimeFunctions({ navigateExternal: void 0 });
			detach();
			setMountedSlotsHeader(null);
		};
	}, [hydrationCachePublication, setTreeStateValue]);
	useEffect(() => {
		hydrationCachePublication.complete();
		const hydratedAt = performance.now();
		window.__VINEXT_HYDRATED_AT = hydratedAt;
		window.__NEXT_HYDRATED = true;
		window.__NEXT_HYDRATED_AT = hydratedAt;
		window.__NEXT_HYDRATED_CB?.();
	}, [hydrationCachePublication]);
	useLayoutEffect(() => {
		historyController.rememberHistoryStateSnapshot(treeState);
	}, [treeState]);
	useEffect(() => {
		setWindowNextInternalSourcePage(AppElementsWire.readMetadata(treeState.elements).sourcePage);
	}, [treeState.elements]);
	useLayoutEffect(() => {
		const previousMountedSlotsHeader = getMountedSlotsHeader();
		const nextMountedSlotsHeader = getMountedSlotIdsHeader(stateRef.current.elements);
		setMountedSlotsHeader(nextMountedSlotsHeader);
		removeStylesheetLinksCoveredByInlineCss();
		if (previousMountedSlotsHeader === nextMountedSlotsHeader) return;
		const pingTimer = window.setTimeout(() => {
			getNavigationRuntime()?.functions.pingVisibleLinks?.();
		}, 0);
		return () => {
			window.clearTimeout(pingTimer);
		};
	}, [treeState.elements]);
	useLayoutEffect(() => {
		if (treeState.renderId !== 0) return;
		historyController.writeHydratedHistoryMetadata({
			bfcacheIds: treeState.bfcacheIds,
			previousNextUrl: treeState.previousNextUrl
		});
	}, [
		treeState.bfcacheIds,
		treeState.previousNextUrl,
		treeState.renderId
	]);
	const routeTree = createElement(RedirectBoundary, null, createElement(NavigationCommitSignal, { renderId: treeState.renderId }, createElement(ElementsContext.Provider, { value: treeState.elements }, createElement(Slot, { id: treeState.routeId }))));
	const bfcacheStateKeys = useMemo(() => createBfcacheSegmentStateKeyMap({
		elements: treeState.elements,
		pathname: treeState.navigationSnapshot.pathname
	}), [treeState.elements, treeState.navigationSnapshot.pathname]);
	const stateKeyTree = createElement(BfcacheStateKeyMapContext.Provider, { value: bfcacheStateKeys }, routeTree);
	const redirectedTree = createElement(AppRouterRedirectBridge, null, BfcacheIdMapContext ? createElement(BfcacheIdMapContext.Provider, { value: treeState.bfcacheIds }, stateKeyTree) : stateKeyTree);
	const innerTree = AppRouterContext ? createElement(AppRouterContext.Provider, { value: appRouterInstance }, redirectedTree) : redirectedTree;
	const committedTree = import.meta.env.DEV ? createElement(DevRecoveryBoundary, {
		isImplicitRootErrorBoundary: true,
		resetKey: treeState.renderId,
		onCatch: handleDevRecoveryBoundaryCatch
	}, innerTree) : innerTree;
	const scrollScopedTree = createElement(AppRouterScrollCommitProvider, { commitId: treeState.renderId }, committedTree);
	const rootErrorTree = createElement(GlobalErrorBoundary, {
		fallback: DEFAULT_GLOBAL_ERROR_COMPONENT,
		children: scrollScopedTree
	});
	const ClientNavigationRenderContext = getClientNavigationRenderContext();
	if (!ClientNavigationRenderContext) return rootErrorTree;
	return createElement(ClientNavigationRenderContext.Provider, { value: treeState.navigationSnapshot }, rootErrorTree);
}
function restoreHydrationNavigationContext(pathname, searchParams, params) {
	setNavigationContext({
		pathname,
		searchParams: new URLSearchParams(searchParams),
		params
	});
}
function restorePopstateScrollPosition(state, options) {
	const shouldContinue = options?.shouldContinue ?? (() => true);
	if (!shouldContinue()) return;
	if (!(state && typeof state === "object" && "__vinext_scrollY" in state)) {
		if (window.location.hash) scrollToHashTargetOnNextFrame(window.location.hash);
		return;
	}
	const y = Number(state.__vinext_scrollY);
	retryScrollTo("__vinext_scrollX" in state ? Number(state.__vinext_scrollX) : 0, y, {
		minFrames: 1,
		shouldContinue
	});
}
function isSameAppRoutePopstateTarget(href) {
	if (!hasBrowserRouterState()) return false;
	const target = new URL(href, window.location.origin);
	const routerState = getBrowserRouterState();
	return createBasePathStrippedPathAndSearch(target, __basePath) === createSnapshotPathAndSearch(routerState.navigationSnapshot);
}
let isPageUnloading = false;
const RSC_RELOAD_KEY = "__vinext_rsc_initial_reload__";
function readReloadFlag() {
	try {
		return sessionStorage.getItem(RSC_RELOAD_KEY);
	} catch {
		return null;
	}
}
function writeReloadFlag(path) {
	try {
		sessionStorage.setItem(RSC_RELOAD_KEY, path);
	} catch {}
}
function clearReloadFlag() {
	try {
		sessionStorage.removeItem(RSC_RELOAD_KEY);
	} catch {}
}
function recoverFromBadInitialRscResponse(reason) {
	const currentPath = window.location.pathname + window.location.search;
	if (readReloadFlag() === currentPath) {
		clearReloadFlag();
		console.error(`[vinext] Initial RSC fetch ${reason} after reload; aborting hydration. Server-rendered HTML remains visible; client components will not hydrate.`);
		return null;
	}
	writeReloadFlag(currentPath);
	if (readReloadFlag() !== currentPath) {
		console.error(`[vinext] Initial RSC fetch ${reason}; sessionStorage unavailable so the reload-loop guard cannot persist — aborting hydration. Server-rendered HTML remains visible; client components will not hydrate.`);
		return null;
	}
	console.warn(`[vinext] Initial RSC fetch ${reason}; reloading once to let the server render the HTML error page`);
	window.location.reload();
	return null;
}
async function readInitialRscStream() {
	const vinext = getVinextBrowserGlobal();
	const runtimeRsc = getNavigationRuntime()?.bootstrap.rsc;
	if (runtimeRsc || vinext.__VINEXT_RSC_CHUNKS__ || vinext.__VINEXT_RSC_DONE__) {
		clearReloadFlag();
		clearHardNavigationLoopGuard();
		if (runtimeRsc) {
			applyRuntimeRscBootstrap(runtimeRsc);
			if (runtimeRsc.done) {
				registerNavigationRuntimeBootstrap({ rsc: void 0 });
				return chunksToReadableStream(runtimeRsc.rsc);
			}
			return createProgressiveRscStream();
		}
		const params = vinext.__VINEXT_RSC_PARAMS__ ?? {};
		if (vinext.__VINEXT_RSC_PARAMS__) applyClientParams(vinext.__VINEXT_RSC_PARAMS__);
		if (vinext.__VINEXT_RSC_NAV__) restoreHydrationNavigationContext(vinext.__VINEXT_RSC_NAV__.pathname, vinext.__VINEXT_RSC_NAV__.searchParams, params);
		return createProgressiveRscStream();
	}
	const rscHeaders = createRscRequestHeaders();
	const rscResponse = await fetch(await createRscRequestUrl(window.location.pathname + window.location.search, rscHeaders), {
		credentials: "include",
		headers: rscHeaders
	});
	if (!rscResponse.ok) return recoverFromBadInitialRscResponse(`returned ${rscResponse.status}`);
	const contentType = rscResponse.headers.get("content-type") ?? "";
	if (!contentType.startsWith("text/x-component")) return recoverFromBadInitialRscResponse(`returned non-RSC content-type "${contentType || "(missing)"}"`);
	if (!rscResponse.body) return recoverFromBadInitialRscResponse("returned empty body");
	clearReloadFlag();
	clearHardNavigationLoopGuard();
	const parsedParams = parseEncodedJsonHeader(rscResponse.headers.get(VINEXT_PARAMS_HEADER));
	const params = parsedParams ?? {};
	if (parsedParams) try {
		applyClientParams(parsedParams);
	} catch {}
	restoreHydrationNavigationContext(window.location.pathname, window.location.search, params);
	return rscResponse.body;
}
function applyRuntimeRscBootstrap(rsc) {
	const params = rsc.params ?? {};
	if (rsc.params) applyClientParams(rsc.params);
	if (rsc.nav) restoreHydrationNavigationContext(rsc.nav.pathname, rsc.nav.searchParams, params);
}
function registerServerActionCallback() {
	setServerCallback((id, args) => {
		const releaseCacheInvalidationGuard = historyController.beginCacheInvalidationGuard();
		const actionInitiation = createActionInitiationSnapshot();
		return loadServerActionClient().then(({ invokeClientServerAction }) => invokeClientServerAction(id, args, actionInitiation, {
			basePath: __basePath,
			clearClientNavigationCaches,
			clientRscCompatibilityId: CLIENT_RSC_COMPATIBILITY_ID,
			commitSameUrlNavigatePayload,
			navigationPlanner,
			performHardNavigation: (url, historyMode) => browserNavigationController.performHardNavigation(url, historyMode),
			renderRedirectPayload(elements, target, actionInitiation, revalidation) {
				const hashIdx = target.href.indexOf("#");
				const actionScrollIntent = beginAppRouterScrollIntent((hashIdx !== -1 ? target.href.slice(hashIdx) : "") || null);
				if (target.type === "push") saveScrollPosition();
				renderNavigationPayload(Promise.resolve(elements), createClientNavigationRenderSnapshot(target.href, actionInitiation.routerState.navigationSnapshot.params), target.href, actionInitiation.navigationId, target.type === "push" ? "push" : "replace", {}, null, null, FRESH_APP_NAVIGATION_PAYLOAD_ORIGIN, target.type === "push" ? "navigate" : "replace", resolveServerActionOperationLane(revalidation), null, actionScrollIntent).catch(() => {
					browserNavigationController.performHardNavigation(target.href);
				});
			},
			syncCurrentHistoryState: (previousNextUrl, bfcacheIds) => historyController.syncCurrentHistoryStatePreviousNextUrl(previousNextUrl, bfcacheIds),
			syncServerActionHttpFallbackHead
		})).finally(releaseCacheInvalidationGuard);
	});
}
async function main() {
	if (!claimInitialAppRouterBootstrap()) return;
	if (hasServerActions) registerServerActionCallback();
	installAppNavigationFailureListeners();
	if (HAS_CLIENT_REWRITES) await preloadHybridClientRouteOwner();
	let devErrorOverlay = null;
	if (import.meta.env.DEV) {
		devErrorOverlay = await import("../client/dev-error-overlay.js");
		devErrorOverlay.installDevErrorOverlay();
		devErrorOverlay.installViteHmrErrorHandler(import.meta.hot);
		devErrorOverlay.reportInitialDevServerErrors();
	}
	const initialRscBootstrap = getNavigationRuntime()?.bootstrap.rsc;
	const rscStream = await readInitialRscStream();
	if (rscStream === null) return;
	bootstrapHydration(rscStream, devErrorOverlay, initialRscBootstrap);
}
function bootstrapHydration(rscStream, devErrorOverlay, initialRscBootstrap) {
	const hydrationCachePublication = createHydrationCachePublication();
	const cacheGeneration = clientNavigationCacheGeneration;
	const [reactBranch, cacheBranch] = rscStream.tee();
	const root = decodeAppElementsPromise(createFromReadableStream(reactBranch));
	const initialNavigationSnapshot = createClientNavigationRenderSnapshot(window.location.href, latestClientParams);
	const initialParams = initialNavigationSnapshot.params;
	const initialPathAndSearch = createSnapshotPathAndSearch(initialNavigationSnapshot);
	const initialCacheBuffer = new Response(cacheBranch).arrayBuffer();
	Promise.all([root, initialCacheBuffer]).then(async ([elements, buffer]) => {
		if (cacheGeneration !== clientNavigationCacheGeneration) return;
		const metadata = AppElementsWire.readMetadata(elements);
		if (!isCompleteAppPayloadMetadata(metadata)) return;
		const mountedSlotsHeader = getMountedSlotIdsHeader(elements);
		const headers = createRscRequestHeaders({ mountedSlotsHeader });
		const rscUrl = await createRscRequestUrl(initialPathAndSearch, headers);
		if (cacheGeneration !== clientNavigationCacheGeneration) return;
		const snapshot = {
			compatibilityIdHeader: CLIENT_RSC_COMPATIBILITY_ID,
			buffer,
			contentType: VINEXT_RSC_CONTENT_TYPE,
			...initialRscBootstrap?.dynamicStaleTimeSeconds !== void 0 ? { dynamicStaleTimeSeconds: initialRscBootstrap.dynamicStaleTimeSeconds } : {},
			mountedSlotsHeader,
			paramsHeader: encodeURIComponent(JSON.stringify(initialParams)),
			renderedPathAndSearch: null,
			url: rscUrl
		};
		const fallbackTtlMs = initialRscBootstrap?.initialCacheKind === "static" ? PREFETCH_CACHE_TTL : DYNAMIC_NAVIGATION_CACHE_TTL;
		hydrationCachePublication.publish(() => {
			if (cacheGeneration !== clientNavigationCacheGeneration) return () => {};
			if (isCacheRestorableAppPayloadMetadata(metadata)) return storeVisitedResponseSnapshot(rscUrl, metadata.interceptionContext, snapshot, initialParams, fallbackTtlMs, mountedSlotsHeader);
			return storeVisitedResponseSnapshot(rscUrl, metadata.interceptionContext, snapshot, initialParams, fallbackTtlMs, mountedSlotsHeader, elements);
		});
	}).catch(() => {});
	historyController.writeBootstrapHistoryMetadata();
	const reportUncaughtError = createOnUncaughtError();
	const onUncaughtError = (...args) => {
		hydrationCachePublication.fail();
		reportUncaughtError(...args);
	};
	const onRecoverableError = (...args) => {
		hydrationCachePublication.fail();
		prodOnRecoverableError(...args);
	};
	const invalidateOnCaughtError = (handler) => ((...args) => {
		hydrationCachePublication.fail();
		handler(...args);
	});
	const formState = consumeInitialFormState(getVinextBrowserGlobal());
	const hydrateRootOptions = import.meta.env.DEV && devErrorOverlay ? createVinextHydrateRootOptions({
		formState,
		onCaughtError: invalidateOnCaughtError(createDevOnCaughtError(devErrorOverlay.devOnCaughtError, onUncaughtError)),
		onUncaughtError
	}) : createVinextHydrateRootOptions({
		formState,
		onCaughtError: invalidateOnCaughtError(createProdOnCaughtError(onUncaughtError)),
		onRecoverableError,
		onUncaughtError
	});
	const children = createElement(BrowserRoot, {
		hydrationCachePublication,
		initialElements: root,
		initialNavigationSnapshot
	});
	const errorShellStyles = document.querySelectorAll("style[data-vinext-error-shell-style]");
	if (document.documentElement.id === "__next_error__") {
		const { formState: _inertFormState, ...createRootOptions } = hydrateRootOptions;
		for (const style of errorShellStyles) style.remove();
		startTransition(() => {
			const clientRoot = createRoot(document, createRootOptions);
			clientRoot.render(children);
			window.__VINEXT_RSC_ROOT__ = clientRoot;
		});
	} else window.__VINEXT_RSC_ROOT__ = hydrateRootInTransition({
		children,
		container: document,
		hydrateRoot,
		options: hydrateRootOptions,
		startTransition
	});
	markInitialAppRouterBootstrapHydrated();
	let activeNavigationAbortController = null;
	function abortSupersededNavigation() {
		activeNavigationAbortController?.abort();
		activeNavigationAbortController = null;
	}
	registerNavigationRuntimeFunctions({
		clearNavigationCaches: clearClientNavigationCaches,
		commitHashNavigation: (href, historyUpdateMode, scroll) => historyController.commitHashOnlyNavigation(href, historyUpdateMode, scroll),
		navigate: async function navigateRsc(href, redirectDepth = 0, navigationKind = "navigate", historyUpdateMode, previousNextUrlOverride, programmaticTransition = false, traversalIntent, scrollIntent, visibleCommitMode = "transition") {
			abortSupersededNavigation();
			const navigationAbortController = new AbortController();
			activeNavigationAbortController = navigationAbortController;
			let pendingRouterState = null;
			const navId = browserNavigationController.beginNavigation();
			const navigationCacheGeneration = clientNavigationCacheGeneration;
			discardedServerActionRefreshScheduler.markNavigationStart();
			let currentHref = href;
			let currentHistoryMode = historyUpdateMode;
			let currentPrevNextUrl = previousNextUrlOverride;
			let redirectCount = redirectDepth;
			let detachedNavigationCommits = false;
			const activeTraversalIntent = navigationKind === "traverse" ? traversalIntent ?? historyController.resolveTraversalIntent(window.history.state) : null;
			const performHardNavigationForScrollIntent = (targetHref, mode) => {
				consumeAppRouterScrollIntent(scrollIntent ?? null);
				const didNavigate = browserNavigationController.performHardNavigation(targetHref, mode);
				if (!didNavigate) clearAppNavigationFailureTarget(targetHref);
				return didNavigate;
			};
			let restoredBfcacheIds = navigationKind === "traverse" ? historyController.readCurrentBfcacheVersionHistoryIds(activeTraversalIntent?.historyState ?? window.history.state) : null;
			const reuseCurrentBfcacheIds = navigationKind !== "traverse" || !historyController.isCacheInvalidationGuarded() && historyController.isCurrentBfcacheVersion(activeTraversalIntent?.historyState ?? window.history.state);
			try {
				const shouldUsePendingRouterState = programmaticTransition;
				if (shouldUsePendingRouterState && hasBrowserRouterState()) pendingRouterState = beginPendingBrowserRouterState();
				else {
					await waitForBrowserRouterStateReady();
					if (!browserNavigationController.isCurrentNavigation(navId)) return;
					if (shouldUsePendingRouterState) pendingRouterState = beginPendingBrowserRouterState();
				}
				while (true) {
					const url = new URL(currentHref, window.location.origin);
					const requestState = getRequestState(navigationKind, url.pathname, currentPrevNextUrl, activeTraversalIntent?.historyState);
					const requestInterceptionContext = requestState.interceptionContext;
					const requestPreviousNextUrl = requestState.previousNextUrl;
					if (navigationKind === "refresh") historyController.syncCurrentHistoryStatePreviousNextUrl(requestPreviousNextUrl, getBrowserRouterState().bfcacheIds);
					setPendingPathname(url.pathname, navId);
					const routerStateAtNavStart = getBrowserRouterState();
					const elementsAtNavStart = routerStateAtNavStart.elements;
					const mountedSlotsHeader = getMountedSlotIdsHeader(elementsAtNavStart);
					const earlyIntentDecision = navigationKind === "navigate" ? navigationPlanner.classifyEarlyNavigationIntent({
						basePath: __basePath,
						currentHref: clientNavigationSnapshotHref(routerStateAtNavStart.navigationSnapshot),
						mode: "push",
						scroll: false,
						targetHref: url.href
					}) : null;
					const shouldBypassNavigationCache = earlyIntentDecision?.kind === "flightNavigation" && earlyIntentDecision.bypassNavigationCache;
					const requestHeaders = createRscRequestHeaders({
						interceptionContext: requestInterceptionContext,
						mountedSlotsHeader
					});
					const rscUrl = await createRscRequestUrl(url.pathname + url.search, requestHeaders);
					const rewrittenNavigationHref = navigationKind === "navigate" && HAS_CLIENT_REWRITES ? resolveLoadedHybridClientRewriteHref(currentHref, __basePath) : null;
					const additionalPrefetchRscUrls = rewrittenNavigationHref && rewrittenNavigationHref !== currentHref ? [await createRscRequestUrl(rewrittenNavigationHref, requestHeaders)] : [];
					const visitedResponseCandidate = shouldBypassNavigationCache ? {
						cacheKey: AppElementsWire.encodeCacheKey(rscUrl, requestInterceptionContext),
						entry: null,
						facts: {
							candidate: "missing",
							navigationKind
						}
					} : readVisitedResponseCacheCandidate(rscUrl, requestInterceptionContext, mountedSlotsHeader, navigationKind);
					const cachedRoute = applyVisitedResponseCacheCandidateDecision(visitedResponseCandidate, navigationPlanner.classifyVisitedResponseCacheCandidate(visitedResponseCandidate.facts));
					const visitedResponse = cachedRoute === null ? { status: "unavailable" } : { status: "available" };
					const prefetchProbeDecision = navigationPlanner.classifyNavigationPrefetchProbe({
						bypassNavigationCache: shouldBypassNavigationCache,
						navigationKind,
						visitedResponse
					});
					let routeManifest = navigationKind === "navigate" ? getBrowserRouteManifest() : null;
					const hasPrefetchCandidate = prefetchProbeDecision.kind === "probe" && hasPrefetchCacheEntryForNavigation(rscUrl, requestInterceptionContext, mountedSlotsHeader, {
						additionalRscUrls: additionalPrefetchRscUrls,
						notifyInvalidation: false
					});
					const reuseDecision = navigationPlanner.classifyNavigationReuse({
						bypassNavigationCache: shouldBypassNavigationCache,
						navigationKind,
						optimisticRouteShell: routeManifest === null ? {
							reason: "routeManifestMissing",
							status: "unavailable"
						} : { status: "available" },
						prefetch: hasPrefetchCandidate ? { status: "available" } : { status: "unavailable" },
						targetHref: currentHref,
						visitedResponse
					});
					if (reuseDecision.kind === "reuseVisitedResponse" && cachedRoute) {
						const cachedFetchDecision = navigationPlanner.classifyRscFetchResult({
							clientCompatibilityId: CLIENT_RSC_COMPATIBILITY_ID,
							compatibilityIdHeader: cachedRoute.response.compatibilityIdHeader ?? null,
							currentHref,
							effectiveHistoryUpdateMode: currentHistoryMode ?? "replace",
							hasBody: true,
							isRscContentType: true,
							origin: window.location.origin,
							redirectDepth: redirectCount,
							requestPreviousNextUrl,
							responseOk: true,
							responseUrl: cachedRoute.response.url,
							source: "cached",
							streamedRedirectTarget: null
						});
						if (cachedFetchDecision.kind === "hardNavigate") {
							if (cachedFetchDecision.reason === "redirectDepthExhausted") console.error("[vinext] Too many RSC redirects — aborting navigation to prevent infinite loop.");
							performHardNavigationForScrollIntent(cachedFetchDecision.url);
							return;
						}
						if (cachedFetchDecision.kind === "followRedirect") {
							if (navigationKind === "traverse") restoredBfcacheIds = null;
							currentHref = cachedFetchDecision.redirect.href;
							currentHistoryMode = cachedFetchDecision.redirect.historyUpdateMode;
							currentPrevNextUrl = cachedFetchDecision.redirect.previousNextUrl;
							redirectCount = cachedFetchDecision.redirect.redirectDepth;
							continue;
						}
						if (!browserNavigationController.isCurrentNavigation(navId)) return;
						const cachedParams = cachedRoute.params;
						const cachedNavigationSnapshot = createClientNavigationRenderSnapshot(currentHref, cachedParams);
						const cachedPayload = cachedRoute.elements ? Promise.resolve(cachedRoute.elements) : decodeAppElementsPromise(createFromFetch(Promise.resolve(restoreRscResponse(cachedRoute.response))));
						if (!browserNavigationController.isCurrentNavigation(navId)) return;
						if (await renderNavigationPayload(cachedPayload, cachedNavigationSnapshot, currentHref, navId, currentHistoryMode, cachedParams, requestPreviousNextUrl, detachedNavigationCommits ? null : pendingRouterState, cachedRoute.elements ? COMMITTED_CACHE_APP_NAVIGATION_PAYLOAD_ORIGIN : VISITED_CACHE_APP_NAVIGATION_PAYLOAD_ORIGIN, toActionType(navigationKind), toOperationLane(navigationKind), activeTraversalIntent, scrollIntent, restoredBfcacheIds, reuseCurrentBfcacheIds, visibleCommitMode) === "no-commit") {
							if (!browserNavigationController.isCurrentNavigation(navId)) return;
							deleteVisitedResponse(rscUrl, requestInterceptionContext);
							continue;
						}
						return;
					}
					let navResponse;
					let navResponseExpiresAt;
					let navResponseUrl = null;
					let fallbackReuseDecision = reuseDecision;
					if (reuseDecision.kind === "consumePrefetch") {
						const prefetchedResponse = await consumePrefetchResponseForNavigation(rscUrl, requestInterceptionContext, mountedSlotsHeader, {
							additionalRscUrls: additionalPrefetchRscUrls,
							shouldConsume: () => browserNavigationController.isCurrentNavigation(navId)
						});
						if (!browserNavigationController.isCurrentNavigation(navId)) return;
						if (prefetchedResponse) {
							navResponse = restoreRscResponse(prefetchedResponse, false);
							navResponseExpiresAt = prefetchedResponse.expiresAt;
							navResponseUrl = isAlternatePrefetchResponseUrl(prefetchedResponse.url, additionalPrefetchRscUrls) ? rscUrl : prefetchedResponse.url;
						}
						if (!navResponse) {
							routeManifest = navigationKind === "navigate" ? getBrowserRouteManifest() : null;
							fallbackReuseDecision = navigationPlanner.classifyNavigationReuse({
								bypassNavigationCache: shouldBypassNavigationCache,
								navigationKind,
								optimisticRouteShell: routeManifest === null ? {
									reason: "routeManifestMissing",
									status: "unavailable"
								} : { status: "available" },
								prefetch: { status: "unavailable" },
								targetHref: currentHref,
								visitedResponse: { status: "unavailable" }
							});
						}
					}
					if (!navResponse && fallbackReuseDecision.kind === "attemptOptimisticRouteShell") {
						await learnOptimisticRouteTemplatesFromPrefetchCache({
							interceptionContext: requestInterceptionContext,
							mountedSlotsHeader,
							routeManifest
						});
						if (!browserNavigationController.isCurrentNavigation(navId)) return;
						if (routeManifest !== null) {
							const optimisticPayload = resolveOptimisticNavigationPayload({
								basePath: __basePath,
								href: currentHref,
								interceptionContext: requestInterceptionContext,
								mountedSlotsHeader,
								routeManifest,
								templates: optimisticRouteTemplates
							});
							if (optimisticPayload !== null) {
								detachedNavigationCommits = true;
								const optimisticNavigationSnapshot = createClientNavigationRenderSnapshot(currentHref, optimisticPayload.params);
								renderNavigationPayload(Promise.resolve(optimisticPayload.elements), optimisticNavigationSnapshot, currentHref, navId, currentHistoryMode, optimisticPayload.params, requestPreviousNextUrl, null, FRESH_APP_NAVIGATION_PAYLOAD_ORIGIN, toActionType(navigationKind), toOperationLane(navigationKind), activeTraversalIntent, scrollIntent, restoredBfcacheIds, reuseCurrentBfcacheIds, visibleCommitMode, void 0, "detached").catch((error) => {
									if (browserNavigationController.isCurrentNavigation(navId)) console.error("[vinext] Optimistic RSC navigation error:", error);
								});
							}
						}
					}
					if (!navResponse) {
						if (navigationKind === "navigate") {
							const clientReuseManifestHeader = createClientReuseManifestHeaderFromVisibleAppState(routerStateAtNavStart);
							if (clientReuseManifestHeader !== null) requestHeaders.set(VINEXT_CLIENT_REUSE_MANIFEST_HEADER, clientReuseManifestHeader);
						}
						navResponse = await fetch(rscUrl, {
							headers: requestHeaders,
							credentials: "include",
							signal: navigationAbortController.signal
						});
					}
					if (!browserNavigationController.isCurrentNavigation(navId)) return;
					const navContentType = navResponse.headers.get("content-type") ?? "";
					const streamedRedirectTarget = navResponse.headers.get(VINEXT_RSC_REDIRECT_HEADER);
					const streamedRedirectTypeHeader = navResponse.headers.get(VINEXT_RSC_REDIRECT_TYPE_HEADER);
					const streamedRedirectType = streamedRedirectTypeHeader === "push" || streamedRedirectTypeHeader === "replace" ? streamedRedirectTypeHeader : null;
					if (blockDangerousStreamedRscRedirect(navResponse, streamedRedirectTarget)) return;
					const liveFetchDecision = navigationPlanner.classifyRscFetchResult({
						clientCompatibilityId: CLIENT_RSC_COMPATIBILITY_ID,
						compatibilityIdHeader: navResponse.headers.get(VINEXT_RSC_COMPATIBILITY_ID_HEADER),
						currentHref,
						effectiveHistoryUpdateMode: currentHistoryMode ?? "replace",
						hasBody: navResponse.body !== null,
						isRscContentType: navContentType.startsWith(VINEXT_RSC_CONTENT_TYPE),
						origin: window.location.origin,
						redirectDepth: redirectCount,
						requestPreviousNextUrl,
						responseOk: navResponse.ok,
						responseUrl: navResponseUrl ?? navResponse.url,
						source: "live",
						streamedRedirectTarget,
						streamedRedirectType
					});
					if (liveFetchDecision.kind === "hardNavigate") {
						if (liveFetchDecision.discardBody) navResponse.body?.cancel().catch(() => {});
						if (liveFetchDecision.reason === "redirectDepthExhausted") console.error("[vinext] Too many RSC redirects — aborting navigation to prevent infinite loop.");
						if (liveFetchDecision.reason === "streamedRedirectLoop") console.error("[vinext] RSC streamed redirect resolved to the current URL — aborting navigation to prevent infinite loop.");
						performHardNavigationForScrollIntent(liveFetchDecision.url, liveFetchDecision.hardNavigationMode);
						return;
					}
					if (liveFetchDecision.kind === "followRedirect") {
						if (liveFetchDecision.discardBody) navResponse.body?.cancel().catch(() => {});
						if (navigationKind === "traverse") restoredBfcacheIds = null;
						currentHref = liveFetchDecision.redirect.href;
						currentHistoryMode = liveFetchDecision.redirect.historyUpdateMode;
						currentPrevNextUrl = liveFetchDecision.redirect.previousNextUrl;
						redirectCount = liveFetchDecision.redirect.redirectDepth;
						continue;
					}
					const navParams = parseEncodedJsonHeader(navResponse.headers.get("X-Vinext-Params")) ?? {};
					const navigationSnapshot = createClientNavigationRenderSnapshot(currentHref, navParams);
					const navBody = navResponse.body;
					if (!navBody) return;
					const [reactBranch, cacheBranch] = navBody.tee();
					const reactResponse = new Response(reactBranch, {
						status: navResponse.status,
						headers: navResponse.headers
					});
					const cacheBufferPromise = new Response(cacheBranch).arrayBuffer();
					cacheBufferPromise.catch(() => {});
					if (!browserNavigationController.isCurrentNavigation(navId)) return;
					const rscPayload = decodeAppElementsPromise(createFromFetch(Promise.resolve(reactResponse)));
					if (!browserNavigationController.isCurrentNavigation(navId)) return;
					let committedState = null;
					if (await renderNavigationPayload(rscPayload, navigationSnapshot, currentHref, navId, currentHistoryMode, navParams, requestPreviousNextUrl, detachedNavigationCommits ? null : pendingRouterState, FRESH_APP_NAVIGATION_PAYLOAD_ORIGIN, toActionType(navigationKind), toOperationLane(navigationKind), activeTraversalIntent, scrollIntent, restoredBfcacheIds, reuseCurrentBfcacheIds, visibleCommitMode, (state) => {
						committedState = state;
						if (activeNavigationAbortController === navigationAbortController) activeNavigationAbortController = null;
					}, detachedNavigationCommits ? "authoritative" : void 0) !== "committed") return;
					try {
						const renderedElements = await rscPayload;
						if (navigationCacheGeneration !== clientNavigationCacheGeneration) return;
						const metadata = AppElementsWire.readMetadata(renderedElements);
						const cacheBuffer = await cacheBufferPromise;
						if (navigationCacheGeneration !== clientNavigationCacheGeneration) return;
						const responseSnapshot = createCachedRscResponseSnapshot(navResponse, cacheBuffer, navResponseUrl);
						const { dynamicStaleTimeSeconds: _staticDynamicStaleTime, ...staticResponseSnapshot } = responseSnapshot;
						const snapshot = {
							...isCacheRestorableAppPayloadMetadata(metadata) ? staticResponseSnapshot : {
								...responseSnapshot,
								...responseSnapshot.dynamicStaleTimeSeconds === void 0 && metadata.dynamicStaleTimeSeconds !== void 0 ? { dynamicStaleTimeSeconds: metadata.dynamicStaleTimeSeconds } : {}
							},
							...navResponseExpiresAt !== void 0 ? { expiresAt: navResponseExpiresAt } : {},
							mountedSlotsHeader: getMountedSlotIdsHeader(renderedElements)
						};
						const interceptionContext = resolveVisitedResponseInterceptionContext(requestInterceptionContext, metadata.interceptionContext);
						if (isCacheRestorableAppPayloadMetadata(metadata)) {
							if (navigationCacheGeneration !== clientNavigationCacheGeneration) return;
							storeVisitedResponseSnapshot(rscUrl, interceptionContext, snapshot, navParams, PREFETCH_CACHE_TTL, mountedSlotsHeader);
						} else if (committedState !== null) {
							const state = committedState;
							const committedElements = {
								...state.elements,
								[AppElementsWire.keys.layoutFlags]: state.layoutFlags,
								[AppElementsWire.keys.layoutIds]: state.layoutIds,
								[AppElementsWire.keys.skippedLayoutIds]: [],
								[AppElementsWire.keys.slotBindings]: state.slotBindings
							};
							if (navigationCacheGeneration !== clientNavigationCacheGeneration) return;
							storeVisitedResponseSnapshot(rscUrl, interceptionContext, snapshot, navParams, DYNAMIC_NAVIGATION_CACHE_TTL, mountedSlotsHeader, committedElements);
						} else {
							if (navigationCacheGeneration !== clientNavigationCacheGeneration) return;
							seedPrefetchResponseSnapshot(rscUrl, snapshot, interceptionContext, mountedSlotsHeader, DYNAMIC_NAVIGATION_CACHE_TTL);
						}
					} catch {}
					return;
				}
			} catch (error) {
				if (!browserNavigationController.isCurrentNavigation(navId)) return;
				if (!isPageUnloading) console.error("[vinext] RSC navigation error:", error);
				performHardNavigationForScrollIntent(navigationPlanner.classifyRscNavigationError({ currentHref }).url);
			} finally {
				if (activeNavigationAbortController === navigationAbortController) activeNavigationAbortController = null;
				browserNavigationController.finalizeNavigation(navId, pendingRouterState);
				discardedServerActionRefreshScheduler.markNavigationSettled();
			}
		}
	});
	const handlePopstate = createPopstateRestoreHandler({
		getActiveNavigationId: browserNavigationController.getActiveNavigationId.bind(browserNavigationController),
		getPendingNavigation: () => window.__VINEXT_RSC_PENDING__,
		getNavigate: () => getNavigationRuntime()?.functions.navigate,
		isCurrentNavigation: browserNavigationController.isCurrentNavigation.bind(browserNavigationController),
		notifyAppRouterTransitionStart: (href) => {
			notifyAppRouterTransitionStart(href, "traverse");
		},
		restorePopstateScrollPosition,
		setPendingNavigation: (pendingNavigation) => {
			window.__VINEXT_RSC_PENDING__ = pendingNavigation;
		},
		shouldSkipScrollRestore: (navId) => synchronousPopstateScrollRestoreNavigationId === navId
	});
	window.addEventListener("popstate", (event) => {
		const href = window.location.href;
		if (isSameAppRoutePopstateTarget(href)) {
			notifyAppRouterTransitionStart(href, "traverse");
			historyController.commitTraversalIndexFromHistoryState(event.state);
			restorePopstateScrollPosition(event.state);
			return;
		}
		const snapshotNavigationId = browserNavigationController.beginNavigation();
		if (restoreHistoryStateSnapshot(event.state, snapshotNavigationId, () => {
			abortSupersededNavigation();
			notifyAppRouterTransitionStart(href, "traverse");
		})) {
			window.__VINEXT_RSC_PENDING__ = null;
			restoreSynchronousPopstateScrollPosition({
				getActiveNavigationId: () => browserNavigationController.getActiveNavigationId(),
				isCurrentNavigation: (navId) => browserNavigationController.isCurrentNavigation(navId),
				markScrollRestoreConsumed: (navId) => {
					synchronousPopstateScrollRestoreNavigationId = navId;
				},
				restorePopstateScrollPosition
			}, event.state);
			browserNavigationController.finalizeNavigation(snapshotNavigationId, null);
			return;
		}
		browserNavigationController.finalizeNavigation(snapshotNavigationId, null);
		handlePopstate(event);
	});
	if (import.meta.env.DEV && import.meta.hot) {
		const applyRscHmrUpdate = async (updateId) => {
			if (updateId !== latestRscHmrUpdateId) return;
			if (document.documentElement.id === "__next_error__") {
				window.location.reload();
				return;
			}
			if (browserRouterStateHasEverCommitted && !browserNavigationController.hasBrowserRouterState()) {
				window.location.reload();
				return;
			}
			await waitForBrowserRouterStateReady();
			if (updateId !== latestRscHmrUpdateId) return;
			if (!browserNavigationController.hasBrowserRouterState()) return;
			clearClientNavigationCaches();
			const navigationSnapshot = createClientNavigationRenderSnapshot(window.location.href, latestClientParams);
			devErrorOverlay?.dismissOverlay();
			const hmrHeaders = createRscRequestHeaders({ mountedSlotsHeader: getMountedSlotIdsHeader(browserNavigationController.getBrowserRouterState().elements) });
			await browserNavigationController.hmrReplaceTree(decodeAppElementsPromise(createFromFetch(fetch(await createRscRequestUrl(window.location.pathname + window.location.search, hmrHeaders), { headers: hmrHeaders }))), navigationSnapshot);
		};
		const handleRscUpdate = async (updateId) => {
			try {
				await waitForRscHmrSettle();
				await applyRscHmrUpdate(updateId);
			} catch (error) {
				console.error("[vinext] RSC HMR error:", error);
			}
		};
		import.meta.hot.on("rsc:update", () => {
			const updateId = ++latestRscHmrUpdateId;
			handleRscUpdate(updateId);
		});
	}
}
if (typeof document !== "undefined") {
	installWindowNext({
		appDir: true,
		router: appRouterInstance
	});
	window.addEventListener("pagehide", () => {
		isPageUnloading = true;
	});
	window.addEventListener("pageshow", (event) => {
		isPageUnloading = false;
		if (event.persisted) mpaNavigationScheduler.reset();
	});
	main();
}
//#endregion
export {};
