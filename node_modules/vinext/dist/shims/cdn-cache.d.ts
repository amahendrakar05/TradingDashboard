import { CacheHandlerValue, IncrementalCacheValue } from "./cache-handler.js";

//#region src/shims/cdn-cache.d.ts
/** A map of response header name -> value the adapter wants applied or removed. */
type CdnResponseHeaders = Record<string, string | null>;
type CdnCacheableHeaderInput = {
  /**
   * The cacheable `Cache-Control` value the framework computed for shared
   * caches (e.g. `s-maxage=60, stale-while-revalidate`). May be an empty string
   * when no cacheable policy applies.
   */
  cacheControl: string;
  /**
   * True when this is a freshly-rendered **streaming** response whose
   * dynamic-ness is not yet proven (late Server Component request-API usage can
   * only be detected after the stream drains).
   *
   * The default adapter forces `no-store` for the browser in this case — the
   * page is instead served from the origin store on subsequent requests. Edge
   * adapters may instead emit edge-only cache headers (e.g. `CDN-Cache-Control`)
   * so the CDN performs SWR while the browser still sees `no-store`.
   */
  pendingDynamicCheck?: boolean;
  /**
   * The cache tags associated with this page/route, already canonicalised
   * (e.g. via `encodeCacheTag`). Edge adapters use these to emit a tag header
   * (e.g. a `Cache-Tag` header) so tag-based purging can target the response.
   * The default adapter ignores them.
   */
  tags?: readonly string[];
};
/**
 * The serving strategy for page-level ISR. Implement this to delegate
 * page/route/image caching to a CDN edge instead of the origin store.
 */
type CdnCacheAdapter = {
  /**
   * Read a page-level artifact. Returning a value lets the origin serve it
   * (HIT/STALE); returning `null` makes the origin render fresh.
   *
   * Default: reads the data cache. Edge adapters typically return `null` so the
   * edge owns serving.
   */
  get(key: string, ctx?: Record<string, unknown>): Promise<CacheHandlerValue | null>;
  /**
   * Persist a freshly-rendered page-level artifact.
   *
   * Default: writes to the data cache. Edge adapters that rely entirely on the
   * CDN may make this a no-op.
   */
  set(key: string, data: IncrementalCacheValue | null, ctx?: Record<string, unknown>): Promise<void>;
  /**
   * Build the response cache headers for a given policy. Returns a map so an
   * adapter can emit more than one header (e.g. `Cache-Control` +
   * `CDN-Cache-Control`) and remove stale adapter-owned headers with `null`.
   */
  buildResponseHeaders(input: CdnCacheableHeaderInput): CdnResponseHeaders;
  /**
   * Whether the **origin** runs in-process background regeneration when a stale
   * entry is served. Edge adapters set this to `false` because the CDN
   * revalidates by re-requesting the origin.
   */
  readonly ownsBackgroundRevalidation: boolean;
  /**
   * Propagate a tag/path invalidation to the CDN edge (purge). Called *in
   * addition to* the data cache's own tag invalidation, so the default
   * implementation is a no-op (the data cache already invalidated its entries).
   *
   * Edge adapters implement this to purge the edge cache — typically firing the
   * purge through the request execution context (`ctx.waitUntil`).
   */
  revalidateTag(tags: string | string[], durations?: {
    expire?: number;
  }): Promise<void>;
};
/**
 * Default origin-managed ISR strategy: store page artifacts in the data cache,
 * serve HIT/STALE from it, run in-process background regeneration, and emit the
 * framework's standard `Cache-Control` headers.
 */
declare class DefaultCdnCacheAdapter implements CdnCacheAdapter {
  readonly ownsBackgroundRevalidation = true;
  get(key: string, ctx?: Record<string, unknown>): Promise<CacheHandlerValue | null>;
  set(key: string, data: IncrementalCacheValue | null, ctx?: Record<string, unknown>): Promise<void>;
  buildResponseHeaders(input: CdnCacheableHeaderInput): CdnResponseHeaders;
  revalidateTag(_tags: string | string[], _durations?: {
    expire?: number;
  }): Promise<void>;
}
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
declare function setCdnCacheAdapter(adapter: CdnCacheAdapter): void;
/**
 * Get the active CDN cache adapter. An explicitly configured adapter wins;
 * otherwise the origin-managed {@link DefaultCdnCacheAdapter} is used.
 */
declare function getCdnCacheAdapter(): CdnCacheAdapter;
//#endregion
export { CdnCacheAdapter, CdnCacheableHeaderInput, CdnResponseHeaders, DefaultCdnCacheAdapter, getCdnCacheAdapter, setCdnCacheAdapter };