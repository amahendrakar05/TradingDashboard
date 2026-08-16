import { CacheControlMetadata } from "../shims/cache-handler.js";
import { NEVER_CACHE_CONTROL, NO_STORE_CACHE_CONTROL } from "./cache-control.js";

//#region src/server/isr-decision.d.ts
type IsrDisposition = "HIT" | "STALE" | "MISS";
type IsrDecision = {
  disposition: IsrDisposition; /** True when the caller must schedule a background regeneration. */
  scheduleRegeneration: boolean; /** The `Cache-Control` string to stamp on the response. */
  cacheControl: string;
};
/**
 * Per-router special-case policies for `Cache-Control`.
 *
 * - `"app-page"` / `"pages"`: `buildCachedRevalidateCacheControl` for HIT/STALE.
 * - `"app-route"`: same, but `revalidateSeconds=0` forces `NEVER_CACHE_CONTROL`
 *   and `revalidateSeconds=Infinity` forces `STATIC_CACHE_CONTROL`.
 * - `"dev"`: like `"pages"`, but `revalidate=0`/`Infinity` guards are absent
 *   (dev never caches when revalidate=0 and never has Infinity entries in practice).
 */
type IsrPolicyKind = "app-page" | "app-route" | "pages" | "dev";
type DecideIsrOptions = {
  /**
   * The cache state. Content guards (kind-mismatch, empty body,
   * query-variant-unproven) must have already passed before passing
   * `"HIT"` or `"STALE"` here.
   */
  cacheState: "HIT" | "STALE" | "MISS"; /** Which router is making the decision. */
  kind: IsrPolicyKind;
  /**
   * The route's configured revalidate window in seconds. Used as the fallback
   * when `cacheControlMeta` is absent.
   *
   * For `"dev"` call sites this is the only source of the revalidate value —
   * dev never has metadata attached to a cache entry.
   */
  revalidateSeconds: number;
  /**
   * The expire ceiling (seconds from epoch) read from the route config.
   * Absent when the route pre-dates expire metadata support.
   */
  expireSeconds?: number;
  /**
   * Optional per-entry metadata written alongside the cache value.
   * When present its `revalidate`/`expire` fields override the route defaults,
   * exactly as the call sites do today with `cacheControl?.revalidate ?? revalidateSeconds`.
   */
  cacheControlMeta?: CacheControlMetadata;
};
/**
 * Derive the `Cache-Control` string for an ISR response.
 *
 * Content guards (kind mismatch, query-variant-unproven, empty body) are the
 * caller's responsibility and must happen *before* this call. `cacheState`
 * must only be `"HIT"` or `"STALE"` when those guards have already passed.
 */
declare function decideIsr(options: DecideIsrOptions): IsrDecision;
/**
 * Build the `Cache-Control` string for a fresh MISS response whose ISR policy
 * is known (i.e. revalidate is set and > 0). Uses the unbounded SWR form when
 * no expire ceiling is available, exactly as `buildRevalidateCacheControl` does.
 *
 * Separate from `decideIsr` because a MISS doesn't read a cache entry and
 * therefore never has `cacheControlMeta`. `expireSeconds` here is the route
 * config ceiling passed directly from the caller (not a per-entry fallback).
 */
declare function buildMissIsrCacheControl(revalidateSeconds: number, expireSeconds?: number): string;
/**
 * Build the `Cache-Control` string for a fresh (MISS) app-route response.
 *
 * Applies the same `revalidateSeconds=0`→NEVER and `Infinity`→STATIC gates
 * that `decideIsr` uses for app-route cached responses. `expireSeconds` is
 * the route config ceiling passed directly (not per-entry metadata fallback).
 *
 * Used by `applyRouteHandlerRevalidateHeader` which operates on a fresh
 * response that has no per-entry cache metadata.
 */
declare function buildAppRouteMissIsrCacheControl(revalidateSeconds: number, expireSeconds?: number): string;
//#endregion
export { NEVER_CACHE_CONTROL as ISR_NEVER_CACHE_CONTROL, NO_STORE_CACHE_CONTROL as ISR_NO_STORE_CACHE_CONTROL, buildAppRouteMissIsrCacheControl, buildMissIsrCacheControl, decideIsr };