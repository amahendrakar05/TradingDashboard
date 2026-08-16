import { CacheLifeConfig } from "./cache-request-state.js";
import { markAppPagePropsForUseCache } from "./internal/app-page-props-cache-key.js";

//#region src/shims/cache-runtime.d.ts
/**
 * Used purely as `cause` for the nested-dynamic cache error: its captured stack
 * points at the inner "use cache" invocation that propagated a dynamic cache
 * life up to the outer cache. Constructed eagerly while the caller is still on
 * the synchronous stack.
 */
declare class NestedDynamicUseCacheError extends Error {
  constructor();
}
type CacheContext = {
  /** Tags collected via cacheTag() during execution */tags: string[]; /** Cache life configs collected via cacheLife() — minimum-wins rule applies */
  lifeConfigs: CacheLifeConfig[]; /** Cache variant: "default" | "remote" | "private" */
  variant: string; /** Whether cacheLife() was called with an explicit revalidate value */
  hasExplicitRevalidate: boolean; /** Whether cacheLife() was called with an explicit expire value */
  hasExplicitExpire: boolean;
  /**
   * The first nested public "use cache" invocation with a dynamic cache life
   * (revalidate === 0 or expire < DYNAMIC_EXPIRE) that propagated up to this
   * cache. Used as `cause` for the nested-dynamic cache error.
   */
  dynamicNestedCacheError: Error | undefined;
  /**
   * Dynamic request API error recorded inside this cache scope. This persists
   * even if user code catches the original throw, so the wrapper can avoid
   * storing request-specific output under a shared cache key.
   */
  invalidDynamicUsageError?: unknown;
};
declare const cacheContextStorage: import("node:async_hooks").AsyncLocalStorage<CacheContext>;
/**
 * Get the current cache context. Returns null if not inside a "use cache" function.
 */
declare function getCacheContext(): CacheContext | null;
/**
 * Build the shared-cache key for a "use cache" function from its build-scoped
 * identity and serialized arguments.
 *
 * This is a logical handler key, not a storage key. Backend-specific adapters
 * are responsible for mapping it to their physical key constraints after
 * applying any storage prefixes.
 *
 * Exported for testing.
 */
declare function buildUseCacheKey(id: string, keySeed: string | undefined, argsKey?: string): string;
/**
 * Convert an encodeReply result (string | FormData) to a cache key string.
 * For FormData (binary args), produces a deterministic SHA-256 hash over
 * the sorted entries. We can't hash `new Response(formData).arrayBuffer()`
 * because multipart boundaries are non-deterministic across serializations.
 *
 * Exported for testing.
 */
declare function replyToCacheKey(reply: string | FormData): Promise<string>;
type PrivateCacheState = {
  _privateCache: Map<string, unknown> | null;
};
/**
 * Run a function within a private cache ALS scope.
 * Ensures per-request isolation for "use cache: private" entries
 * on concurrent runtimes.
 */
declare function runWithPrivateCache<T>(fn: () => Promise<T>): Promise<T>;
declare function runWithPrivateCache<T>(fn: () => T | Promise<T>): T | Promise<T>;
/**
 * Clear the private per-request cache. Should be called at the start of each request.
 * Only needed when not using runWithPrivateCache() (legacy path).
 */
declare function clearPrivateCache(): void;
type RegisterCachedFunctionOptions = {
  /**
   * Internal transform metadata for file-level `"use cache"` default exports
   * in App Router `page.*` files. Page components receive framework-owned
   * `{ params, searchParams }` props. React may copy that props object before
   * invocation, so this invariant must live at the cached function boundary
   * rather than on the intermediate createElement config object.
   */
  appPageDefaultExport?: boolean;
};
/**
 * Register a function as a cached function. This is called by the Vite
 * transform for each "use cache" function.
 *
 * @param fn - The original async function
 * @param id - A stable identifier for the function (module path + export name)
 * @param variant - Cache variant: "" (default/shared), "remote", "private"
 * @returns A wrapper function that checks cache before calling the original
 */
declare function registerCachedFunction<TArgs extends unknown[], TResult>(fn: (...args: TArgs) => Promise<TResult>, id: string, variant?: string, options?: RegisterCachedFunctionOptions): (...args: TArgs) => Promise<TResult>;
//#endregion
export { CacheContext, NestedDynamicUseCacheError, PrivateCacheState, buildUseCacheKey, cacheContextStorage, clearPrivateCache, getCacheContext, markAppPagePropsForUseCache, registerCachedFunction, replyToCacheKey, runWithPrivateCache };