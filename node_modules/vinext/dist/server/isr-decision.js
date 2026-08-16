import { NEVER_CACHE_CONTROL, NO_STORE_CACHE_CONTROL, STATIC_CACHE_CONTROL, buildCachedRevalidateCacheControl, buildRevalidateCacheControl } from "./cache-control.js";
//#region src/server/isr-decision.ts
/** Resolve effective revalidate/expire, preferring per-entry metadata. */
function resolveRevalidate(options) {
	return {
		effectiveRevalidate: options.cacheControlMeta?.revalidate ?? options.revalidateSeconds,
		effectiveExpire: options.cacheControlMeta === void 0 ? void 0 : options.cacheControlMeta.expire ?? options.expireSeconds
	};
}
function buildCacheControl(disposition, kind, revalidate, expire) {
	if (kind === "app-route") {
		if (revalidate === 0) return NEVER_CACHE_CONTROL;
		if (revalidate === Infinity) return STATIC_CACHE_CONTROL;
	}
	return buildCachedRevalidateCacheControl(disposition, revalidate, expire);
}
/**
* Derive the `Cache-Control` string for an ISR response.
*
* Content guards (kind mismatch, query-variant-unproven, empty body) are the
* caller's responsibility and must happen *before* this call. `cacheState`
* must only be `"HIT"` or `"STALE"` when those guards have already passed.
*/
function decideIsr(options) {
	if (options.cacheState === "MISS") return {
		disposition: "MISS",
		scheduleRegeneration: false,
		cacheControl: ""
	};
	const { effectiveRevalidate, effectiveExpire } = resolveRevalidate(options);
	if (options.cacheState === "HIT") return {
		disposition: "HIT",
		scheduleRegeneration: false,
		cacheControl: buildCacheControl("HIT", options.kind, effectiveRevalidate, effectiveExpire)
	};
	return {
		disposition: "STALE",
		scheduleRegeneration: true,
		cacheControl: buildCacheControl("STALE", options.kind, effectiveRevalidate, effectiveExpire)
	};
}
/**
* Build the `Cache-Control` string for a fresh MISS response whose ISR policy
* is known (i.e. revalidate is set and > 0). Uses the unbounded SWR form when
* no expire ceiling is available, exactly as `buildRevalidateCacheControl` does.
*
* Separate from `decideIsr` because a MISS doesn't read a cache entry and
* therefore never has `cacheControlMeta`. `expireSeconds` here is the route
* config ceiling passed directly from the caller (not a per-entry fallback).
*/
function buildMissIsrCacheControl(revalidateSeconds, expireSeconds) {
	return buildRevalidateCacheControl(revalidateSeconds, expireSeconds);
}
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
function buildAppRouteMissIsrCacheControl(revalidateSeconds, expireSeconds) {
	if (revalidateSeconds === 0) return NEVER_CACHE_CONTROL;
	if (revalidateSeconds === Infinity) return STATIC_CACHE_CONTROL;
	return buildRevalidateCacheControl(revalidateSeconds, expireSeconds);
}
//#endregion
export { NEVER_CACHE_CONTROL as ISR_NEVER_CACHE_CONTROL, NO_STORE_CACHE_CONTROL as ISR_NO_STORE_CACHE_CONTROL, buildAppRouteMissIsrCacheControl, buildMissIsrCacheControl, decideIsr };
