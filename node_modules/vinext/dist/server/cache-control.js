import { getCdnCacheAdapter } from "../shims/cdn-cache.js";
//#region src/server/cache-control.ts
const NEVER_CACHE_CONTROL = "private, no-cache, no-store, max-age=0, must-revalidate";
const BROWSER_REVALIDATE_CACHE_CONTROL = "public, max-age=0, must-revalidate";
const STATIC_CACHE_CONTROL = "s-maxage=31536000, stale-while-revalidate";
const STALE_REVALIDATE_CACHE_CONTROL = "s-maxage=0, stale-while-revalidate";
const NO_STORE_CACHE_CONTROL = "no-store, must-revalidate";
const SHARED_CACHE_DIRECTIVE_RE = /(?:^|,)\s*s-maxage\s*=/i;
function shouldUseNextDeployCacheControl() {
	return process.env.VINEXT_NEXT_DEPLOY_CACHE_CONTROL === "1";
}
function isSharedCacheControl(cacheControl) {
	return SHARED_CACHE_DIRECTIVE_RE.test(cacheControl);
}
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
function applyCdnResponseHeaders(headers, input) {
	headers.delete("Cache-Control");
	if (shouldUseNextDeployCacheControl() && isSharedCacheControl(input.cacheControl)) {
		headers.set("Cache-Control", BROWSER_REVALIDATE_CACHE_CONTROL);
		return;
	}
	const map = getCdnCacheAdapter().buildResponseHeaders(input);
	for (const [name, value] of Object.entries(map)) {
		if (value === null) {
			headers.delete(name);
			continue;
		}
		if (value === "") continue;
		headers.set(name, value);
	}
}
/**
* Matches Next.js's `getCacheControlHeader` stale window semantics while
* preserving vinext's legacy unbounded SWR header when no expire ceiling is
* available yet.
*
* Next.js source:
* https://github.com/vercel/next.js/blob/canary/packages/next/src/server/lib/cache-control.ts
*/
function buildRevalidateCacheControl(revalidateSeconds, expireSeconds) {
	if (expireSeconds === void 0) return `s-maxage=${revalidateSeconds}, stale-while-revalidate`;
	if (revalidateSeconds >= expireSeconds) return `s-maxage=${revalidateSeconds}`;
	return `s-maxage=${revalidateSeconds}, stale-while-revalidate=${expireSeconds - revalidateSeconds}`;
}
/**
* Builds Cache-Control for ISR cache reads. HIT responses and STALE responses
* with stored expire metadata use the same route policy because Next.js derives
* this header from cache-control metadata, not from the cache hit/stale state.
* STALE entries without expire metadata keep vinext's legacy `s-maxage=0`
* fallback so older cache entries are not treated as newly fresh downstream.
*/
function buildCachedRevalidateCacheControl(cacheState, revalidateSeconds, expireSeconds) {
	if (revalidateSeconds === Infinity) return STATIC_CACHE_CONTROL;
	if (cacheState === "STALE" && expireSeconds === void 0) return STALE_REVALIDATE_CACHE_CONTROL;
	return buildRevalidateCacheControl(revalidateSeconds, expireSeconds);
}
//#endregion
export { BROWSER_REVALIDATE_CACHE_CONTROL, NEVER_CACHE_CONTROL, NO_STORE_CACHE_CONTROL, STATIC_CACHE_CONTROL, applyCdnResponseHeaders, buildCachedRevalidateCacheControl, buildRevalidateCacheControl, shouldUseNextDeployCacheControl };
