import { AppRouterScrollIntent } from "./app-router-scroll-state.js";
import { NavigationRuntimeVisibleCommitMode } from "../client/navigation-runtime.js";
import { AppRouterInstance, NavigateOptions, PrefetchOptions as PrefetchOptions$1 } from "./internal/app-router-context.js";
import { ReadonlyURLSearchParams } from "./readonly-url-search-params.js";
import { GLOBAL_ACCESSORS_KEY, NavigationContext, NavigationStateAccessors, SegmentMap, ServerInsertedHTMLContext, _registerStateAccessors, clearServerInsertedHTML, flushServerInsertedHTML, getBfcacheIdMapContext, getBfcacheSegmentIdContext, getLayoutSegmentContext, getNavigationContext, renderServerInsertedHTML, setNavigationContext } from "./navigation-context-state.js";
import { BailoutToCSRError, DynamicServerError, HTTP_ERROR_FALLBACK_ERROR_CODE, RedirectType, decodeRedirectError, forbidden, getAccessFallbackHTTPStatus, isBailoutToCSRError, isDynamicServerError, isHTTPAccessFallbackError, isNextRouterError, isRedirectError, notFound, permanentRedirect, redirect, unauthorized, unstable_rethrow } from "./navigation-errors.js";
import { UnrecognizedActionError, unstable_isUnrecognizedActionError } from "./unrecognized-action-error.js";
import * as React$1 from "react";
import { Params } from "@vinext/types/next/upstream/dist/server/request/params";

//#region src/shims/navigation.d.ts
/** Load rewrite-aware hybrid route ownership before navigation becomes interactive. */
declare function preloadHybridClientRouteOwner(): Promise<void>;
declare function resolveLoadedHybridClientRewriteHref(href: string, basePath: string): string | null;
/** basePath from next.config.js, injected by the plugin at build time */
declare const __basePath: string;
/** Maximum buffered bytes in the RSC prefetch cache. Mirrors Next.js' 50 MB LRU. */
declare const MAX_PREFETCH_CACHE_SIZE: number;
declare const DYNAMIC_NAVIGATION_CACHE_TTL: number;
declare const PREFETCH_CACHE_TTL: number;
/** A buffered RSC response stored as an ArrayBuffer for replay. */
type CachedRscResponse = {
  compatibilityIdHeader?: string | null;
  buffer: ArrayBuffer;
  contentType: string;
  dynamicStaleTimeSeconds?: number;
  expiresAt?: number;
  mountedSlotsHeader?: string | null;
  paramsHeader: string | null;
  renderedPathAndSearch: string | null;
  url: string;
};
type PrefetchOptions = {
  kind?: unknown;
  onInvalidate?: () => void;
};
type PrefetchCacheKind = "loading-shell" | "navigation" | "route-tree";
type PrefetchCacheEntry = {
  cacheForNavigation?: boolean;
  expiresAt?: number;
  invalidationTimer?: ReturnType<typeof setTimeout>;
  mountedSlotsHeader?: string | null;
  onInvalidateCallbacks?: Set<() => void>;
  optimisticRouteShell?: boolean;
  outcome: "pending" | "cache-seeded";
  snapshot?: CachedRscResponse;
  cacheKeys?: Set<string>;
  pending?: Promise<void>;
  prefetchKind?: PrefetchCacheKind;
  searchAgnosticShell?: boolean;
  size?: number;
  timestamp: number;
};
declare function getCurrentInterceptionContext(): string | null;
declare function getPrefetchInterceptionContext(targetHref: string): string | null;
declare function getCurrentNextUrl(): string;
/** Get or create the shared in-memory RSC prefetch cache on window. */
declare function getPrefetchCache(): Map<string, PrefetchCacheEntry>;
/**
 * Get or create the shared set of already-prefetched RSC URLs on window.
 * Keyed by interception-aware cache key so distinct source routes do not alias.
 */
declare function getPrefetchedUrls(): Set<string>;
declare function resolveCachedRscResponseTtlMs(cached: Pick<CachedRscResponse, "dynamicStaleTimeSeconds">, fallbackTtlMs: number): number;
declare function resolveCachedRscResponseExpiresAt(timestamp: number, cached: Pick<CachedRscResponse, "dynamicStaleTimeSeconds" | "expiresAt">, fallbackTtlMs: number): number;
declare function resolvePrefetchCacheEntryMountedSlotsHeader(entry: PrefetchCacheEntry): string | null;
declare function hasPrefetchCacheEntryForNavigation(rscUrl: string, interceptionContext?: string | null, mountedSlotsHeader?: string | null, options?: {
  additionalRscUrls?: readonly string[];
  notifyInvalidation?: boolean;
}): boolean;
declare function hasSearchAgnosticPrefetchShellForRoute(rscUrl: string, interceptionContext?: string | null, mountedSlotsHeader?: string | null): boolean;
declare function invalidatePrefetchCache(): void;
declare function seedPrefetchResponseSnapshot(rscUrl: string, snapshot: CachedRscResponse, interceptionContext?: string | null, mountedSlotsHeader?: string | null, fallbackTtlMs?: number): void;
declare function deletePrefetchResponseSnapshot(rscUrl: string, snapshot: CachedRscResponse, interceptionContext?: string | null): void;
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
declare function storePrefetchResponse(rscUrl: string, response: Response, interceptionContext?: string | null, options?: PrefetchOptions): void;
declare function createCachedRscResponseSnapshot(response: Response, buffer: ArrayBuffer, responseUrl?: string | null): CachedRscResponse;
/**
 * Snapshot an RSC response to an ArrayBuffer for caching and replay.
 * Consumes the response body and stores it with content-type and URL metadata.
 */
declare function snapshotRscResponse(response: Response): Promise<CachedRscResponse>;
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
declare function restoreRscResponse(cached: CachedRscResponse, copy?: boolean): Response;
/**
 * Prefetch an RSC response and snapshot it for later consumption.
 * Stores the in-flight promise so immediate clicks can await it instead
 * of firing a duplicate fetch.
 * Enforces a maximum cache size to prevent unbounded memory growth on
 * link-heavy pages.
 */
declare function prefetchRscResponse(rscUrl: string, fetchPromise: Promise<Response>, interceptionContext?: string | null, mountedSlotsHeader?: string | null, options?: PrefetchOptions, behavior?: {
  cacheForNavigation?: boolean;
  fallbackTtlMs?: number;
  optimisticRouteShell?: boolean;
  prefetchKind?: PrefetchCacheKind;
  searchAgnosticShell?: boolean;
}): void;
declare function peekPrefetchResponseForNavigation(rscUrl: string, interceptionContext?: string | null, mountedSlotsHeader?: string | null): CachedRscResponse | null;
/**
 * Consume a prefetched response for a given rscUrl.
 * Only returns settled (non-pending) snapshots synchronously.
 * Returns null if the entry is still in flight or doesn't exist.
 */
declare function consumePrefetchResponse(rscUrl: string, interceptionContext?: string | null, mountedSlotsHeader?: string | null): CachedRscResponse | null;
/**
 * Consume a prefetched response for navigation. Unlike the synchronous cache
 * read above, this waits for an already-started prefetch snapshot before
 * deciding whether to fetch again. That preserves the ownership invariant set
 * up by prefetchRscResponse(): a pending cache entry means this URL already has
 * one in-flight network request that navigation should share.
 */
type ConsumePrefetchResponseForNavigationOptions = {
  additionalRscUrls?: readonly string[];
  shouldConsume?: () => boolean;
};
declare function consumePrefetchResponseForNavigation(rscUrl: string, interceptionContext?: string | null, mountedSlotsHeader?: string | null, options?: ConsumePrefetchResponseForNavigationOptions): Promise<CachedRscResponse | null>;
type NavigationListener = () => void;
type ClientNavigationState = {
  listeners: Set<NavigationListener>;
  cachedSearch: string;
  cachedReadonlySearchParams: ReadonlyURLSearchParams;
  cachedPathname: string;
  clientParams: Record<string, string | string[]>;
  clientParamsJson: string;
  pendingClientParams: Record<string, string | string[]> | null;
  pendingClientParamsJson: string | null;
  pendingPathname: string | null;
  pendingPathnameNavId: number | null;
  originalPushState: typeof window.history.pushState;
  originalReplaceState: typeof window.history.replaceState;
  patchInstalled: boolean;
  hasPendingNavigationUpdate: boolean;
  suppressUrlNotifyCount: number;
  navigationSnapshotActiveCount: number;
};
type CommitClientNavigationStateOptions = {
  releaseSnapshot?: boolean;
};
declare function setMountedSlotsHeader(header: string | null): void;
declare function getMountedSlotsHeader(): string | null;
declare function getClientNavigationState(): ClientNavigationState | null;
/**
 * Mark a navigation snapshot as active. Called before startTransition
 * in renderNavigationPayload. While active, hooks prefer the snapshot
 * context value over useSyncExternalStore. Uses a counter (not boolean)
 * to handle overlapping navigations — rapid clicks can interleave
 * activate/deactivate if multiple transitions are in flight.
 */
declare function activateNavigationSnapshot(): void;
type ClientNavigationRenderSnapshot = {
  pathname: string;
  searchParams: ReadonlyURLSearchParams;
  params: Record<string, string | string[]>;
};
declare function getClientNavigationRenderContext(): React$1.Context<ClientNavigationRenderSnapshot | null> | null;
/** @internal */
declare function useClientNavigationRenderSnapshot(): ClientNavigationRenderSnapshot | null;
declare function createClientNavigationRenderSnapshot(href: string, params: Record<string, string | string[]>): ClientNavigationRenderSnapshot;
declare function createSnapshotPathAndSearch(snapshot: ClientNavigationRenderSnapshot): string;
declare function setClientParams(params: Record<string, string | string[]>): void;
declare function replaceClientParamsWithoutNotify(params: Record<string, string | string[]>): void;
/** Get the current client params (for testing referential stability). */
declare function getClientParams(): Record<string, string | string[]>;
/**
 * Set the pending pathname for client-side navigation.
 * Strips the base path before storing. Associates the pathname with the given navId
 * so only that navigation (or a newer one) can clear it.
 */
declare function setPendingPathname(pathname: string, navId: number): void;
/**
 * Clear the pending pathname, but only if the given navId matches the one
 * that set it, or if pendingPathnameNavId is null (no active owner).
 * This prevents superseded navigations from clearing state belonging to newer navigations.
 */
declare function clearPendingPathname(navId: number): void;
/**
 * Returns the current pathname.
 * Server: from request context. Client: from window.location.
 */
declare function usePathname(): string;
/**
 * Returns the current search params as a read-only URLSearchParams.
 */
declare function useSearchParams(): ReadonlyURLSearchParams;
/**
 * Returns the dynamic params for the current route.
 */
declare function useParams<T extends Params = Params>(): T | null;
/**
 * Commit pending client navigation state to committed snapshots.
 *
 * navId is optional: callers that don't own pendingPathname (for example,
 * superseded pre-paint cleanup) may pass undefined to flush URL/params state
 * without clearing pendingPathname owned by the active navigation. Such callers
 * must opt in explicitly if they also own an activated render snapshot.
 */
declare function commitClientNavigationState(navId?: number, options?: CommitClientNavigationStateOptions): void;
declare function pushHistoryStateWithoutNotify(data: unknown, unused: string, url?: string | URL | null): void;
declare function replaceHistoryStateWithoutNotify(data: unknown, unused: string, url?: string | URL | null): void;
/**
 * Save the current scroll position into the current history state.
 * Called before every navigation to enable scroll restoration on back/forward.
 *
 * Uses replaceHistoryStateWithoutNotify to avoid triggering the patched
 * history.replaceState interception (which would cause spurious re-renders).
 */
declare function saveScrollPosition(): void;
declare function applyAppRouterScrollFallback(intent: AppRouterScrollIntent): void;
/**
 * Navigate to a URL, handling external URLs, hash-only changes, and RSC navigation.
 */
declare function navigateClientSide(href: string, mode: "push" | "replace", scroll: boolean, programmaticTransition?: boolean, visibleCommitMode?: NavigationRuntimeVisibleCommitMode): Promise<void>;
/**
 * Public App Router instance, exposed for the browser entry so it can wire
 * `window.next.router` to the same singleton returned from `useRouter()`.
 *
 * Mirrors `publicAppRouterInstance` from Next.js's
 * `packages/next/src/client/components/app-router-instance.ts` (line 392).
 */
declare const appRouterInstance: AppRouterInstance;
/**
 * App Router's useRouter — returns push/replace/back/forward/refresh.
 * Different from Pages Router's useRouter (next/router).
 *
 * Preserves the mounted AppRouterContext router as the authority for methods
 * and layers the nearest segment's contextual `bfcacheId` on top.
 */
declare function useRouter(): {
  back(): void;
  forward(): void;
  refresh(): void;
  push(href: string, options?: NavigateOptions): void;
  replace(href: string, options?: NavigateOptions): void;
  prefetch(href: string, options?: PrefetchOptions$1): void;
  experimental_gesturePush?(href: string, options?: NavigateOptions): void;
  bfcacheId: string;
};
/**
 * Returns the active child segment one level below the layout where it's called.
 *
 * Returns the first segment from the route tree below this layout, including
 * route groups (e.g., "(marketing)") and resolved dynamic params. Returns null
 * if at the leaf (no child segments).
 *
 * @param parallelRoutesKey - Which parallel route to read (default: "children")
 */
declare function useSelectedLayoutSegment(parallelRoutesKey?: string): string | null;
/**
 * Returns all active segments below the layout where it's called.
 *
 * Each layout in the App Router tree wraps its children with a
 * LayoutSegmentProvider whose value is a map of parallel route key to
 * segment arrays. The "children" key is the default parallel route.
 *
 * @param parallelRoutesKey - Which parallel route to read (default: "children")
 */
declare function useSelectedLayoutSegments(parallelRoutesKey?: string): string[];
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
declare function useServerInsertedHTML(callback: () => unknown): void;
//#endregion
export { BailoutToCSRError, CachedRscResponse, ClientNavigationRenderSnapshot, DYNAMIC_NAVIGATION_CACHE_TTL, DynamicServerError, GLOBAL_ACCESSORS_KEY, HTTP_ERROR_FALLBACK_ERROR_CODE, MAX_PREFETCH_CACHE_SIZE, type NavigationContext, type NavigationStateAccessors, PREFETCH_CACHE_TTL, PrefetchCacheEntry, PrefetchCacheKind, PrefetchOptions, ReadonlyURLSearchParams, RedirectType, type SegmentMap, ServerInsertedHTMLContext, UnrecognizedActionError, __basePath, _registerStateAccessors, activateNavigationSnapshot, appRouterInstance, applyAppRouterScrollFallback, clearPendingPathname, clearServerInsertedHTML, commitClientNavigationState, consumePrefetchResponse, consumePrefetchResponseForNavigation, createCachedRscResponseSnapshot, createClientNavigationRenderSnapshot, createSnapshotPathAndSearch, decodeRedirectError, deletePrefetchResponseSnapshot, flushServerInsertedHTML, forbidden, getAccessFallbackHTTPStatus, getBfcacheIdMapContext, getBfcacheSegmentIdContext, getClientNavigationRenderContext, getClientNavigationState, getClientParams, getCurrentInterceptionContext, getCurrentNextUrl, getLayoutSegmentContext, getMountedSlotsHeader, getNavigationContext, getPrefetchCache, getPrefetchInterceptionContext, getPrefetchedUrls, hasPrefetchCacheEntryForNavigation, hasSearchAgnosticPrefetchShellForRoute, invalidatePrefetchCache, isBailoutToCSRError, isDynamicServerError, isHTTPAccessFallbackError, isNextRouterError, isRedirectError, navigateClientSide, notFound, peekPrefetchResponseForNavigation, permanentRedirect, prefetchRscResponse, preloadHybridClientRouteOwner, pushHistoryStateWithoutNotify, redirect, renderServerInsertedHTML, replaceClientParamsWithoutNotify, replaceHistoryStateWithoutNotify, resolveCachedRscResponseExpiresAt, resolveCachedRscResponseTtlMs, resolveLoadedHybridClientRewriteHref, resolvePrefetchCacheEntryMountedSlotsHeader, restoreRscResponse, saveScrollPosition, seedPrefetchResponseSnapshot, setClientParams, setMountedSlotsHeader, setNavigationContext, setPendingPathname, snapshotRscResponse, storePrefetchResponse, unauthorized, unstable_isUnrecognizedActionError, unstable_rethrow, useClientNavigationRenderSnapshot, useParams, usePathname, useRouter, useSearchParams, useSelectedLayoutSegment, useSelectedLayoutSegments, useServerInsertedHTML };