import { AsyncLocalStorage } from "node:async_hooks";

//#region src/shims/internal/als-registry.d.ts
/**
 * Get (or lazily create) the AsyncLocalStorage registered on `globalThis`
 * under `Symbol.for(key)`. Multiple callers — including callers in different
 * module instances — that pass the same `key` receive the same ALS instance.
 *
 * @param key - String key fed to `Symbol.for(...)`. By convention vinext
 *   shims use a dotted namespace such as `"vinext.cache.als"`.
 */
declare function getOrCreateAls<T>(key: string): AsyncLocalStorage<T>;
//#endregion
export { getOrCreateAls };