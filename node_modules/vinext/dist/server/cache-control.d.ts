import { CdnCacheableHeaderInput } from "../shims/cdn-cache.js";

//#region src/server/cache-control.d.ts
declare const NEVER_CACHE_CONTROL = "private, no-cache, no-store, max-age=0, must-revalidate";
declare const BROWSER_REVALIDATE_CACHE_CONTROL = "public, max-age=0, must-revalidate";
declare const STATIC_CACHE_CONTROL = "s-maxage=31536000, stale-while-revalidate";
declare const NO_STORE_CACHE_CONTROL = "no-store, must-revalidate";
declare function shouldUseNextDeployCacheControl(): boolean;
/**
 * Route a cacheable response's headers through the active CDN cache adapter and
 * apply the result to `headers`. The default adapter yields a single
 * `Cache-Control` identical to `input.cacheControl` (no behavior change); edge
 * adapters may instead emit `CDN-Cache-Control` / `Cache-Tag`.
 *
 * We only clear `Cache-Control` — the one header vinext stamps internally — so
 * a stale vinext value never lingers if an adapter chooses not to emit one. The
 * adapter's own headers are applied via `set()`, which overrides any prior value
 * for the same name, so there's no need to pre-clear adapter-specific headers.
 */
declare function applyCdnResponseHeaders(headers: Headers, input: CdnCacheableHeaderInput): void;
/**
 * Matches Next.js's `getCacheControlHeader` stale window semantics while
 * preserving vinext's legacy unbounded SWR header when no expire ceiling is
 * available yet.
 *
 * Next.js source:
 * https://github.com/vercel/next.js/blob/canary/packages/next/src/server/lib/cache-control.ts
 */
declare function buildRevalidateCacheControl(revalidateSeconds: number, expireSeconds?: number): string;
/**
 * Builds Cache-Control for ISR cache reads. HIT responses and STALE responses
 * with stored expire metadata use the same route policy because Next.js derives
 * this header from cache-control metadata, not from the cache hit/stale state.
 * STALE entries without expire metadata keep vinext's legacy `s-maxage=0`
 * fallback so older cache entries are not treated as newly fresh downstream.
 */
declare function buildCachedRevalidateCacheControl(cacheState: "HIT" | "STALE", revalidateSeconds: number, expireSeconds?: number): string;
//#endregion
export { BROWSER_REVALIDATE_CACHE_CONTROL, NEVER_CACHE_CONTROL, NO_STORE_CACHE_CONTROL, STATIC_CACHE_CONTROL, applyCdnResponseHeaders, buildCachedRevalidateCacheControl, buildRevalidateCacheControl, shouldUseNextDeployCacheControl };