//#region src/shims/cache-request-state.d.ts
type CacheLifeConfig = {
  stale?: number;
  revalidate?: number;
  expire?: number;
};
declare const cacheLifeProfiles: Record<string, CacheLifeConfig>;
type CacheContextLike = {
  tags: string[];
  lifeConfigs: CacheLifeConfig[];
  variant: string;
  hasExplicitRevalidate: boolean;
  hasExplicitExpire: boolean;
  dynamicNestedCacheError: Error | undefined;
};
declare function _registerCacheContextAccessor(fn: () => CacheContextLike | null): void;
declare function getRegisteredCacheContext(): CacheContextLike | null;
type UnstableCacheRevalidationMode = "foreground" | "background";
type ActionRevalidationKind = 0 | 1 | 2;
type UnstableCacheObservation = Readonly<{
  kind: "unstable_cache";
  keyHash: string;
  revalidate: number | false | null;
  tagCount: number;
  tagHash: string | null;
}>;
type CacheState = {
  actionRevalidationKind: ActionRevalidationKind;
  pendingRevalidatedTags: Set<string>;
  pendingRevalidations: Set<Promise<void>>;
  requestScopedCacheLife: CacheLifeConfig | null;
  unstableCacheObservations: Map<string, UnstableCacheObservation>;
  unstableCacheRevalidation: UnstableCacheRevalidationMode;
};
declare const ACTION_DID_REVALIDATE_STATIC_AND_DYNAMIC = 1;
declare const ACTION_DID_REVALIDATE_DYNAMIC_ONLY = 2;
declare function _runWithCacheState<T>(fn: () => Promise<T>): Promise<T>;
declare function _runWithCacheState<T>(fn: () => T | Promise<T>): T | Promise<T>;
declare function _initRequestScopedCacheState(): void;
declare function markActionRevalidation(kind: ActionRevalidationKind): void;
declare function getAndClearActionRevalidationKind(): ActionRevalidationKind;
/** @internal */
declare function _markPendingRevalidatedTag(tag: string): void;
/** @internal */
declare function _hasPendingRevalidatedTag(tags: readonly string[]): boolean;
/**
 * Record a cache invalidation that must finish before the current action or
 * route-handler request is finalized. The public revalidation APIs remain
 * synchronous, matching Next.js, while the request boundary owns the await.
 *
 * Returns false outside a request-like phase so standalone calls can retain
 * their historical background-work behavior without accumulating promises in
 * the process-global fallback state.
 *
 * @internal
 */
declare function _queuePendingRevalidation(promise: Promise<void>): boolean;
/**
 * Await and clear every cache invalidation queued in the current request.
 * Clearing before awaiting also lets a later drain observe work enqueued by
 * an async continuation while this batch is settling.
 *
 * @internal
 */
declare function _drainPendingRevalidations(): Promise<void>;
declare function _setRequestScopedCacheLife(config: CacheLifeConfig): void;
declare function _peekRequestScopedCacheLife(): CacheLifeConfig | null;
declare function _consumeRequestScopedCacheLife(): CacheLifeConfig | null;
declare function recordUnstableCacheObservation(observation: UnstableCacheObservation): void;
declare function _peekUnstableCacheObservations(): UnstableCacheObservation[];
declare function shouldServeStaleUnstableCacheEntry(): boolean;
//#endregion
export { ACTION_DID_REVALIDATE_DYNAMIC_ONLY, ACTION_DID_REVALIDATE_STATIC_AND_DYNAMIC, ActionRevalidationKind, CacheLifeConfig, CacheState, UnstableCacheObservation, UnstableCacheRevalidationMode, _consumeRequestScopedCacheLife, _drainPendingRevalidations, _hasPendingRevalidatedTag, _initRequestScopedCacheState, _markPendingRevalidatedTag, _peekRequestScopedCacheLife, _peekUnstableCacheObservations, _queuePendingRevalidation, _registerCacheContextAccessor, _runWithCacheState, _setRequestScopedCacheLife, cacheLifeProfiles, getAndClearActionRevalidationKind, getRegisteredCacheContext, markActionRevalidation, recordUnstableCacheObservation, shouldServeStaleUnstableCacheEntry };