import { AsyncLocalStorage } from "node:async_hooks";

//#region src/shims/internal/work-unit-async-storage.d.ts
type RequestStore = {
  readonly type: "request";
};
type PrerenderStore = {
  readonly type: "prerender" | "prerender-client" | "prerender-runtime"; /** AbortSignal that fires when the prerender is cancelled or completed. */
  readonly renderSignal: AbortSignal; /** Optional route identifier for debugging and error messages. */
  readonly route?: string;
};
type CacheStore = {
  readonly type: "cache" | "private-cache" | "unstable-cache";
};
type GenerateStaticParamsStore = {
  readonly type: "generate-static-params";
};
type PrerenderLegacyStore = {
  readonly type: "prerender-legacy";
};
/**
 * Discriminated union of all known work unit types.
 * Matches Next.js's WorkUnitStore: packages/next/src/server/app-render/work-unit-async-storage.external.ts
 */
type WorkUnitStore = RequestStore | PrerenderStore | CacheStore | GenerateStaticParamsStore | PrerenderLegacyStore;
type WorkUnitAsyncStorage = AsyncLocalStorage<WorkUnitStore>;
declare const workUnitAsyncStorage: WorkUnitAsyncStorage;
declare const requestAsyncStorage: WorkUnitAsyncStorage;
//#endregion
export { CacheStore, GenerateStaticParamsStore, PrerenderLegacyStore, PrerenderStore, RequestStore, WorkUnitAsyncStorage, WorkUnitStore, requestAsyncStorage, workUnitAsyncStorage };