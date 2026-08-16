import { ACTION_DID_REVALIDATE_DYNAMIC_ONLY, ACTION_DID_REVALIDATE_STATIC_AND_DYNAMIC, ActionRevalidationKind, CacheLifeConfig, CacheState, UnstableCacheObservation, UnstableCacheRevalidationMode, _consumeRequestScopedCacheLife, _drainPendingRevalidations, _hasPendingRevalidatedTag, _initRequestScopedCacheState, _markPendingRevalidatedTag, _peekRequestScopedCacheLife, _peekUnstableCacheObservations, _queuePendingRevalidation, _registerCacheContextAccessor, _runWithCacheState, _setRequestScopedCacheLife, cacheLifeProfiles, getAndClearActionRevalidationKind, getRegisteredCacheContext, markActionRevalidation, recordUnstableCacheObservation, shouldServeStaleUnstableCacheEntry } from "./cache-request-state.js";
import { ExecutionContextLike, getRequestExecutionContext, runWithExecutionContext } from "./request-context.js";
import { CacheControlMetadata, CacheHandler, CacheHandlerContext, CacheHandlerValue, CachedAppPageValue, CachedFetchValue, CachedImageValue, CachedPagesValue, CachedRedirectValue, CachedRouteValue, IncrementalCacheValue, MemoryCacheHandler, NoOpCacheHandler, configureMemoryCacheHandler, getCacheHandler, getDataCacheHandler, setCacheHandler, setDataCacheHandler } from "./cache-handler.js";

//#region src/shims/cache.d.ts
/**
 * Revalidate cached data associated with a specific cache tag.
 *
 * Works with both `fetch(..., { next: { tags: ['myTag'] } })` and
 * `unstable_cache(fn, keys, { tags: ['myTag'] })`.
 *
 * Next.js 16 updated signature: accepts a cacheLife profile as second argument
 * for stale-while-revalidate (SWR) behavior. The single-argument form is
 * deprecated but still supported for backward compatibility.
 *
 * @param tag - Cache tag to revalidate
 * @param profile - cacheLife profile name (e.g. 'max', 'hours') or inline { expire: number }
 */
declare function revalidateTag(tag: string, profile?: string | {
  expire?: number;
}): undefined;
/**
 * Revalidate cached data associated with a specific path.
 *
 * Invalidation works through implicit tags generated at render time by
 * `buildAppPageCacheTags`, matching Next.js's getDerivedTags:
 *
 * - `type: "layout"` → invalidates `_N_T_<path>/layout`, cascading to all
 *   descendant pages (they carry ancestor layout tags from render time).
 * - `type: "page"` → invalidates `_N_T_<path>/page`, targeting only the
 *   exact route's page component.
 * - No type → invalidates `_N_T_<path>` (broader, exact path).
 *
 * The `type` parameter is App Router only — Pages Router does not generate
 * layout/page hierarchy tags, so only no-type invalidation applies there.
 */
declare function revalidatePath(path: string, type?: "page" | "layout"): undefined;
/**
 * No-op shim for API compatibility.
 *
 * In Next.js, calling `refresh()` inside a Server Action triggers a
 * client-side router refresh so the user immediately sees updated data.
 * vinext reports the dynamic-only invalidation through the Server Action
 * response header that the client router already understands.
 */
declare function refresh(): void;
/**
 * Expire a cache tag immediately (Next.js 16).
 *
 * Server Actions-only API that expires a tag so the next request
 * fetches fresh data. Unlike `revalidateTag`, which uses stale-while-revalidate,
 * `updateTag` invalidates synchronously within the same request context.
 *
 * Throws if called outside a Server Action — e.g. from a Route Handler or
 * during render — matching Next.js's enforcement. For Route Handlers, callers
 * should use `revalidateTag` instead.
 *
 * @see https://nextjs.org/docs/app/api-reference/functions/updateTag
 */
declare function updateTag(tag: string): undefined;
/**
 * Opt out of static rendering and indicate a particular component should not be cached.
 *
 * In Next.js, calling noStore() inside a Server Component ensures the component
 * is dynamically rendered. In our implementation, this is a no-op since we don't
 * have the same static/dynamic rendering split — all server rendering is on-demand.
 * It's provided for API compatibility so apps importing it don't break.
 */
declare function unstable_noStore(): void;
/**
 * Marks an IO boundary in server components by returning a resolved promise
 * during requests and a hanging promise during prerendering.
 *
 * See: https://github.com/vercel/next.js/pull/92521
 * Guard removed: https://github.com/vercel/next.js/pull/92923
 * Stabilized (renamed from unstable_io): https://github.com/vercel/next.js/pull/93621
 *
 * Ported from Next.js: packages/next/src/server/request/io.ts
 * https://github.com/vercel/next.js/blob/canary/packages/next/src/server/request/io.ts
 *
 * Behavior by work unit type:
 * - request → resolve immediately (no delay needed for dynamic SSR)
 * - prerender / prerender-client / prerender-runtime → hang (prevent
 *   execution past IO boundary during static generation)
 * - cache / private-cache / unstable-cache → resolve immediately
 *   (caches capture IO results at fill time)
 * - generate-static-params → resolve immediately (build time, no prerender to stall)
 * - prerender-legacy → resolve immediately (no cache components)
 *
 * When no work unit store is present (e.g. client-side, standalone script),
 * resolves immediately — matching the browser/client implementation.
 */
declare function io(): Promise<void>;
/**
 * @deprecated Use `io` instead. Kept as a transitional alias since vinext
 * shipped the unstable name longer than upstream Next.js (see #805). Will be
 * removed in a future minor.
 */
declare function unstable_io(): Promise<void>;
/**
 * Set the cache lifetime for a "use cache" function.
 *
 * Accepts either a built-in profile name (e.g., "hours", "days") or a custom
 * configuration object. In Next.js, this only works inside "use cache" functions.
 *
 * When called inside a "use cache" function, this sets the cache TTL.
 * The "minimum-wins" rule applies: if called multiple times, the shortest
 * duration for each field wins.
 *
 * When called outside a "use cache" context, this is a validated no-op.
 */
declare function cacheLife(profile: string | CacheLifeConfig): void;
/**
 * Tag a "use cache" function's cached result for on-demand revalidation.
 *
 * Tags set here can be invalidated via revalidateTag(). In Next.js, this only
 * works inside "use cache" functions.
 *
 * When called inside a "use cache" function, tags are attached to the cached
 * entry. They can later be invalidated via revalidateTag().
 *
 * When called outside a "use cache" context, this is a no-op.
 */
declare function cacheTag(...tags: string[]): void;
declare function unstable_cacheLife(profile: string | CacheLifeConfig): void;
declare function unstable_cacheTag(...tags: string[]): void;
/**
 * Check if the current execution context is inside an unstable_cache() callback.
 * Used by headers(), cookies(), and connection() to throw errors when
 * dynamic request APIs are called inside a cache scope.
 */
declare function isInsideUnstableCacheScope(): boolean;
type UnstableCacheOptions = {
  revalidate?: number | false;
  tags?: string[];
};
/**
 * Wrap an async function with caching.
 *
 * Returns a new function that caches results. The cache key is derived
 * from keyParts + serialized arguments.
 */
declare function unstable_cache<T extends (...args: any[]) => Promise<any>>(fn: T, keyParts?: string[], options?: UnstableCacheOptions): T;
//#endregion
export { ACTION_DID_REVALIDATE_DYNAMIC_ONLY, ACTION_DID_REVALIDATE_STATIC_AND_DYNAMIC, ActionRevalidationKind, CacheControlMetadata, CacheHandler, CacheHandlerContext, CacheHandlerValue, CacheLifeConfig, CacheState, CachedAppPageValue, CachedFetchValue, CachedImageValue, CachedPagesValue, CachedRedirectValue, CachedRouteValue, type ExecutionContextLike, IncrementalCacheValue, MemoryCacheHandler, NoOpCacheHandler, UnstableCacheObservation, UnstableCacheRevalidationMode, _consumeRequestScopedCacheLife, _drainPendingRevalidations, _hasPendingRevalidatedTag, _initRequestScopedCacheState, _markPendingRevalidatedTag, _peekRequestScopedCacheLife, _peekUnstableCacheObservations, _queuePendingRevalidation, _registerCacheContextAccessor, _runWithCacheState, _setRequestScopedCacheLife, cacheLife, cacheLifeProfiles, cacheTag, configureMemoryCacheHandler, getAndClearActionRevalidationKind, getCacheHandler, getDataCacheHandler, getRegisteredCacheContext, getRequestExecutionContext, io, isInsideUnstableCacheScope, markActionRevalidation, unstable_noStore as noStore, unstable_noStore, recordUnstableCacheObservation, refresh, revalidatePath, revalidateTag, runWithExecutionContext, setCacheHandler, setDataCacheHandler, shouldServeStaleUnstableCacheEntry, unstable_cache, unstable_cacheLife, unstable_cacheTag, unstable_io, updateTag };