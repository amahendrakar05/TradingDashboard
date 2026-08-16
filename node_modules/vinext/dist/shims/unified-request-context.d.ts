import { CacheState } from "./cache-request-state.js";
import { RootParamsState } from "./root-params.js";
import { ExecutionContextLike } from "./request-context.js";
import { FetchCacheState } from "./fetch-cache.js";
import { VinextHeadersShimState } from "./headers.js";
import { RouterState } from "./router-state.js";
import { PrivateCacheState } from "./cache-runtime.js";
import { HeadState } from "./head-state.js";
import { I18nState } from "./i18n-state.js";
import { NavigationState } from "./navigation-state.js";
//#region src/shims/unified-request-context.d.ts
/**
 * Flat union of all per-request state previously spread across
 * VinextHeadersShimState, NavigationState, CacheState, PrivateCacheState,
 * FetchCacheState, and ExecutionContextLike.
 *
 * Each field group is documented with its source shim module.
 */
type UnifiedRequestContext = {
  /** Cloudflare Workers ExecutionContext, or null on Node.js dev. */executionContext: ExecutionContextLike | null; /** Per-request cache for cacheForRequest(). Keyed by factory function reference. */
  requestCache: WeakMap<(...args: any[]) => any, unknown>;
} & VinextHeadersShimState & I18nState & NavigationState & CacheState & PrivateCacheState & FetchCacheState & RouterState & HeadState & RootParamsState;
/**
 * Create a fresh `UnifiedRequestContext` with defaults for all fields.
 * Pass partial overrides for the fields you need to pre-populate.
 */
declare function createRequestContext(opts?: Partial<UnifiedRequestContext>): UnifiedRequestContext;
/**
 * Run `fn` within a unified request context scope.
 * All shim modules will read/write their state from `ctx` for the
 * duration of the call, including async continuations.
 */
declare function runWithRequestContext<T>(ctx: UnifiedRequestContext, fn: () => Promise<T>): Promise<T>;
declare function runWithRequestContext<T>(ctx: UnifiedRequestContext, fn: () => T | Promise<T>): T | Promise<T>;
/**
 * Run `fn` in a nested unified scope derived from the current request context.
 * Used by legacy runWith* wrappers to reset or override one sub-state while
 * preserving proper async isolation for continuations created inside `fn`.
 * The child scope is a shallow clone of the parent store, so untouched fields
 * keep sharing their existing references while overridden slices can be reset.
 *
 * @internal
 */
declare function runWithUnifiedStateMutation<T>(mutate: (ctx: UnifiedRequestContext) => void, fn: () => Promise<T>): Promise<T>;
declare function runWithUnifiedStateMutation<T>(mutate: (ctx: UnifiedRequestContext) => void, fn: () => T | Promise<T>): T | Promise<T>;
/**
 * Get the current unified request context.
 * Returns the ALS store when inside a `runWithRequestContext()` scope,
 * or a fresh detached context otherwise. Unlike the legacy per-shim fallback
 * singletons, this detached value is ephemeral — mutations do not persist
 * across calls. This is intentional to prevent state leakage outside request
 * scopes.
 *
 * Only direct callers observe this detached fallback. Shim `_getState()`
 * helpers should continue to gate on `isInsideUnifiedScope()` and fall back
 * to their standalone ALS/fallback singletons outside the unified scope.
 * If called inside a standalone `runWithExecutionContext()` scope, the
 * detached context still reflects that inherited `executionContext`.
 */
declare function getRequestContext(): UnifiedRequestContext;
/**
 * Check whether the current execution is inside a `runWithRequestContext()` scope.
 * Shim modules use this to decide whether to read from the unified store
 * or fall back to their own standalone ALS.
 */
declare function isInsideUnifiedScope(): boolean;
//#endregion
export { UnifiedRequestContext, createRequestContext, getRequestContext, isInsideUnifiedScope, runWithRequestContext, runWithUnifiedStateMutation };