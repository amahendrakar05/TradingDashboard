import { getDataCacheHandler } from "./cache-handler.js";
//#region src/shims/cdn-cache.ts
/**
* CDN cache adapter — owns the *page-level ISR serving strategy*.
*
* This is deliberately distinct from the data cache handler (see `./cache.ts`):
*
* - The **data cache** stores cached data (fetch, `"use cache"`,
*   `unstable_cache`, route-handler data). It is a pure key/value store.
*
* - The **CDN cache adapter** decides *how page-level ISR is served*: where the
*   rendered page/route/image artifacts live, what cache headers the response
*   carries, whether the origin runs background regeneration, and how
*   invalidation propagates to a CDN edge.
*
* Two strategies sit behind one interface:
*
* | Concern            | DefaultCdnCacheAdapter (origin-managed) | Edge adapter (CDN-managed)                  |
* | ------------------ | --------------------------------------- | ------------------------------------------- |
* | Serve from store?  | Yes — reads the data cache              | No — origin renders fresh, edge caches      |
* | Background regen   | In-process via `waitUntil`              | Edge re-requests origin                     |
* | Response headers   | `Cache-Control` (SWR)                   | `Cache-Control: no-store` + `CDN-Cache-Control: <SWR>` |
* | Invalidation       | (data cache handles tag invalidation)   | purge / revalidate via request context      |
*
* The default adapter is a thin shim over the data cache + the framework's
* existing header logic, so default behavior is byte-for-byte identical to the
* pre-split implementation.
*/
const PENDING_DYNAMIC_CACHE_CONTROL = "no-store, must-revalidate";
/**
* Default origin-managed ISR strategy: store page artifacts in the data cache,
* serve HIT/STALE from it, run in-process background regeneration, and emit the
* framework's standard `Cache-Control` headers.
*/
var DefaultCdnCacheAdapter = class {
	ownsBackgroundRevalidation = true;
	async get(key, ctx) {
		return getDataCacheHandler().get(key, ctx);
	}
	async set(key, data, ctx) {
		await getDataCacheHandler().set(key, data, ctx);
	}
	buildResponseHeaders(input) {
		if (input.pendingDynamicCheck) return { "Cache-Control": PENDING_DYNAMIC_CACHE_CONTROL };
		return { "Cache-Control": input.cacheControl };
	}
	async revalidateTag(_tags, _durations) {}
};
const _CDN_KEY = Symbol.for("vinext.cdnCacheAdapter");
const _gCdn = globalThis;
let _defaultAdapter = null;
/**
* Set a custom CDN cache adapter to delegate page-level ISR to a CDN edge. An
* explicit adapter always wins over the built-in request-context / default
* selection.
*
* @deprecated Don't wire up the CDN cache adapter imperatively. Configure it
* declaratively via the `cache.cdn` option on the `vinext()` plugin in your
* `vite.config.ts`, using a config-time adapter builder. On Cloudflare Workers:
*
* ```ts
* import { vinext } from "vinext";
* import { cdnAdapter } from "@vinext/cloudflare/cache/cdn-adapter";
*
* export default defineConfig({
*   plugins: [vinext({ cache: { cdn: cdnAdapter() } })],
* });
* ```
*
* The plugin registers the adapter across every runtime/router entry, so you
* don't have to call this from a worker entry. This setter remains as the
* internal registration target and for backwards compatibility, but is not the
* recommended consumer API.
*/
function setCdnCacheAdapter(adapter) {
	_gCdn[_CDN_KEY] = adapter;
}
/**
* Get the active CDN cache adapter. An explicitly configured adapter wins;
* otherwise the origin-managed {@link DefaultCdnCacheAdapter} is used.
*/
function getCdnCacheAdapter() {
	const active = _gCdn[_CDN_KEY];
	if (active) return active;
	return _defaultAdapter ??= new DefaultCdnCacheAdapter();
}
//#endregion
export { DefaultCdnCacheAdapter, getCdnCacheAdapter, setCdnCacheAdapter };
