//#region src/shims/fetch-cache.d.ts
/**
 * Extended fetch() with Next.js caching semantics.
 *
 * Patches `globalThis.fetch` during server rendering to support:
 *
 *   fetch(url, { next: { revalidate: 60, tags: ['posts'] } })
 *   fetch(url, { cache: 'force-cache' })
 *   fetch(url, { cache: 'no-store' })
 *
 * Cached responses are stored via the pluggable CacheHandler, so
 * revalidateTag() and revalidatePath() invalidate fetch-level caches.
 *
 * Usage (in server entry):
 *   import { withFetchCache, cleanupFetchCache } from './fetch-cache';
 *   const cleanup = withFetchCache();
 *   try { ... render ... } finally { cleanup(); }
 *
 * Or use the async helper:
 *   await runWithFetchCache(async () => { ... render ... });
 */
type NextFetchOptions = {
  revalidate?: number | false;
  tags?: string[];
};
type FetchDedupeEntry = {
  key: string;
  promise: Promise<Response>;
  response: Response | null;
};
declare global {
  interface RequestInit {
    next?: NextFetchOptions;
  }
}
/** @internal Reset dedup state — exposed for test isolation only. */
declare function _resetPendingRefetches(): void;
type FetchCacheState = {
  cacheableFetchUrls: Set<string>;
  currentRequestTags: string[];
  currentFetchSoftTags: string[];
  currentFetchCacheMode: FetchCacheMode | null;
  currentForceDynamicFetchDefault: boolean;
  dynamicFetchUrls: Set<string>;
  refreshStaleFetchesInForeground: boolean;
  isFetchDedupeActive: boolean;
  currentFetchDedupeEntries: Map<string, FetchDedupeEntry[]>;
};
type FetchCacheMode = "auto" | "default-cache" | "default-no-store" | "force-cache" | "force-no-store" | "only-cache" | "only-no-store";
declare function peekCacheableFetchObservations(): string[];
declare function peekDynamicFetchObservations(): string[];
declare function consumeDynamicFetchObservations(): string[];
/**
 * Get tags collected during the current render pass.
 * Useful for associating page-level cache entries with all the
 * fetch tags used during rendering.
 */
declare function getCollectedFetchTags(): string[];
/**
 * Append cache tags to the current request's collected tags.
 *
 * Mirrors Next.js's `propagateCacheLifeAndTagsToRevalidateStore`: tags declared
 * inside a `"use cache"` function (via `cacheTag()`, persisted on the data cache
 * entry) must also bubble up to the surrounding page / route-handler ISR entry
 * so `revalidateTag()` / `revalidatePath()` can evict the rendered output, not
 * just the inner data cache entry. Without this, a cached `"use cache"` result
 * keeps being served from a stale page/route entry after its tag is revalidated
 * (issue #1453). Tags are already encoded by the caller; deduped to match the
 * tagged-fetch path. A no-op for empty input.
 */
declare function addCollectedRequestTags(tags: readonly string[]): void;
/**
 * Set path-derived implicit tags for fetch cache reads in the current render.
 *
 * These are intentionally not persisted on fetch entries. They mirror Next.js
 * `softTags`: `revalidatePath()` should make a fetch miss while rendering the
 * affected route, without permanently coupling a shared fetch entry to one path.
 */
declare function setCurrentFetchSoftTags(tags: string[]): void;
/**
 * Read the path-derived soft tags for the current render.
 *
 * Used by the "use cache" runtime to pass soft tags to the cache handler
 * so that `revalidatePath()` invalidates "use cache" entries during the
 * affected route's next request, even when the entry carries no hard tags.
 */
declare function getCurrentFetchSoftTags(): string[];
declare function setCurrentFetchCacheMode(mode: FetchCacheMode | null): void;
declare function setCurrentForceDynamicFetchDefault(enabled: boolean): void;
declare function setRefreshStaleFetchesInForeground(enabled: boolean): void;
/**
 * Install the patched fetch and reset per-request tag state.
 * Returns a cleanup function that clears tags.
 *
 * @deprecated Prefer `runWithFetchCache()` which uses `AsyncLocalStorage.run()`
 * for proper per-request isolation in concurrent environments.
 *
 * Usage:
 *   const cleanup = withFetchCache();
 *   try { await render(); } finally { cleanup(); }
 */
declare function withFetchCache(): () => void;
/**
 * Run an async function with patched fetch caching enabled.
 * Uses `AsyncLocalStorage.run()` for proper per-request isolation
 * of collected fetch tags in concurrent server environments.
 */
declare function runWithFetchCache<T>(fn: () => Promise<T>): Promise<T>;
/**
 * Activate per-render fetch memoization without resetting request fetch tags.
 * Next.js request memoization is scoped to React render work, not the whole
 * request pipeline, so route handlers and middleware stay observable.
 *
 * ALS scope lifetime: when `fn` returns synchronously (e.g. wrapping a
 * `renderToReadableStream` call), the ALS scope established here only covers
 * the synchronous portion. Any fetch work that happens later during async
 * stream consumption falls back to the parent ALS store, which is fine when
 * the parent already activated dedupe (the common dispatch case) but means
 * standalone callers must keep the dedupe scope alive across consumption.
 */
declare function runWithFetchDedupe<T>(fn: () => T): T;
declare function runWithFetchDedupe<T>(fn: () => Promise<T>): Promise<T>;
/**
 * Install the patched fetch without creating a standalone ALS scope.
 *
 * `runWithFetchCache()` is the standalone helper: it installs the patch and
 * creates an isolated per-request tag store. The unified request context owns
 * that isolation itself via `currentRequestTags`, so callers inside
 * `runWithRequestContext()` only need the process-global fetch monkey-patch.
 */
declare function ensureFetchPatch(): void;
/**
 * Get the original (unpatched) fetch function.
 * Useful for internal code that should bypass caching.
 */
declare function getOriginalFetch(): typeof globalThis.fetch;
//#endregion
export { FetchCacheMode, FetchCacheState, _resetPendingRefetches, addCollectedRequestTags, consumeDynamicFetchObservations, ensureFetchPatch, getCollectedFetchTags, getCurrentFetchSoftTags, getOriginalFetch, peekCacheableFetchObservations, peekDynamicFetchObservations, runWithFetchCache, runWithFetchDedupe, setCurrentFetchCacheMode, setCurrentFetchSoftTags, setCurrentForceDynamicFetchDefault, setRefreshStaleFetchesInForeground, withFetchCache };