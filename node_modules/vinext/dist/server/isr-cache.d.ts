import { OnRequestErrorContext } from "./instrumentation.js";
import { RenderObservation } from "./cache-proof.js";
import { AppRscRenderMode } from "./app-rsc-render-mode.js";
import { normalizeMountedSlotsHeader } from "./app-mounted-slots-header.js";
import { CacheHandlerValue, CachedAppPageValue, CachedPagesValue, IncrementalCacheValue } from "../shims/cache-handler.js";

//#region src/server/isr-cache.d.ts
/**
 * Header set on the internal request that `res.revalidate()` issues to
 * trigger on-demand ISR regeneration of a Pages Router route. Mirrors Next.js's
 * `PRERENDER_REVALIDATE_HEADER` (`x-prerender-revalidate`) — see
 * `.nextjs-ref/packages/next/src/lib/constants.ts`.
 *
 * SECURITY: in Next.js this header is NOT a presence flag — it carries the
 * secret `previewModeId`, and `checkIsOnDemandRevalidate`
 * (`.nextjs-ref/packages/next/src/server/api-utils/index.ts`) only treats a
 * request as on-demand revalidation when the value *equals* that secret. If we
 * gated on presence alone, any external client could send
 * `x-prerender-revalidate: <anything>` to force synchronous regeneration of any
 * ISR page, bypassing the fresh/stale cache short-circuits — a
 * cache-stampede/DoS vector. We therefore validate the value against
 * {@link getRevalidateSecret} (a build-time secret shared across all Workers
 * isolates) with a constant-time comparison, and only the matching value (sent
 * by our own `res.revalidate()`) is honored.
 */
declare const PRERENDER_REVALIDATE_HEADER = "x-prerender-revalidate";
/**
 * Companion header to {@link PRERENDER_REVALIDATE_HEADER}. When set,
 * `res.revalidate(path, { unstable_onlyGenerated: true })` only revalidates the
 * path if it was already generated, and a 404 response counts as a successful
 * no-op. Mirrors Next.js's `PRERENDER_REVALIDATE_ONLY_GENERATED_HEADER`
 * (`x-prerender-revalidate-if-generated`) — see
 * `.nextjs-ref/packages/next/src/lib/constants.ts`.
 */
declare const PRERENDER_REVALIDATE_ONLY_GENERATED_HEADER = "x-prerender-revalidate-if-generated";
declare function getRevalidateSecret(): string;
declare function isRevalidateSecret(value: string | null | undefined): boolean;
/**
 * Authorize an incoming request as an on-demand revalidation trigger. Mirrors
 * Next.js's `checkIsOnDemandRevalidate`: the {@link PRERENDER_REVALIDATE_HEADER}
 * value must *equal* the process revalidate secret. Header presence alone is
 * NOT sufficient — see the security note on {@link PRERENDER_REVALIDATE_HEADER}.
 */
declare function isOnDemandRevalidateRequest(headerValue: string | string[] | null | undefined): boolean;
type ISRCacheEntry = {
  value: CacheHandlerValue;
  isStale: boolean;
};
/**
 * Get a cache entry with staleness information.
 *
 * Returns { value, isStale: false } for fresh entries,
 * { value, isStale: true } for expired-but-usable entries,
 * or null for cache misses.
 */
declare function isrGet(key: string): Promise<ISRCacheEntry | null>;
/**
 * Store a value in the ISR cache with a revalidation period.
 */
declare function isrSet(key: string, data: IncrementalCacheValue, revalidateSeconds: number, tags?: string[], expireSeconds?: number): Promise<void>;
declare function isrSetPrerenderedAppPage(key: string, data: CachedAppPageValue, metadata: {
  expireSeconds?: number;
  revalidateSeconds?: number;
  /**
   * Implicit/path tags to attach to the seeded entry. Required so that
   * `revalidatePath()` (and `revalidateTag()`) can invalidate prerender-seeded
   * cache entries — without tags the entry is unreachable by tag-based
   * invalidation and remains stale until natural `revalidateAt` expiry.
   * See cloudflare/vinext#1486.
   */
  tags?: string[];
}): Promise<void>;
/**
 * Trigger a background regeneration for a cache key.
 *
 * If a regeneration for this key is already in progress, this is a no-op.
 * The renderFn should produce the new cache value and call isrSet internally.
 *
 * On Cloudflare Workers the regeneration promise is registered with
 * `ctx.waitUntil()` via the ALS-backed ExecutionContext, keeping the isolate
 * alive until the regeneration completes even after the Response is returned.
 *
 * When `errorContext` is provided and the render function fails, the error
 * is reported via `reportRequestError` (instrumentation hook) with
 * `revalidateReason: "stale"`.
 */
declare function triggerBackgroundRegeneration(key: string, renderFn: () => Promise<void>, errorContext?: {
  routerKind: OnRequestErrorContext["routerKind"];
  routePath: string;
  routeType: OnRequestErrorContext["routeType"];
}): void;
/**
 * Build a CachedPagesValue for the Pages Router ISR cache.
 */
declare function buildPagesCacheValue(html: string, pageData: object, status?: number): CachedPagesValue;
/**
 * Build a CachedAppPageValue for the App Router ISR cache.
 */
declare function buildAppPageCacheValue(html: string, rscData?: ArrayBuffer, status?: number, renderObservation?: RenderObservation, headers?: CachedAppPageValue["headers"]): CachedAppPageValue;
/**
 * Compute an ISR cache key for a given router type and pathname.
 * Long pathnames are hashed to stay within KV key-length limits (512 bytes).
 */
declare function isrCacheKey(router: string, pathname: string, buildId?: string): string;
/**
 * Compute an App Router ISR key for one cache artifact.
 *
 * App pages store HTML, RSC payloads, and route-handler responses separately.
 * The suffix mirrors Next.js's separate on-disk app artifacts while keeping the
 * Cloudflare KV key under its 512-byte limit for long pathnames.
 */
declare function appIsrCacheKey(pathname: string, suffix: string, buildId?: string | undefined): string;
declare function appIsrHtmlKey(pathname: string): string;
/**
 * Build the ISR cache key for an RSC payload.
 *
 * Variants are sequenced in order: `source:<hash>` (intercepted source context,
 * only when an interception context is present), `slots:<hash>` (mounted parallel
 * route slots), and optionally `<render-mode-variant>` (for example,
 * `prefetch-loading-shell`). Existing cached entries under the old format will
 * become unreachable after deployment. This is acceptable because ISR entries
 * have TTLs and will be regenerated on the next request.
 */
declare function appIsrRscKey(pathname: string, mountedSlotsHeader?: string | null, renderMode?: AppRscRenderMode, interceptionContext?: string | null): string;
declare function appIsrRouteKey(pathname: string): string;
/**
 * Store the revalidate duration for a cache key.
 * Uses insertion-order LRU eviction to prevent unbounded growth.
 */
declare function setRevalidateDuration(key: string, seconds: number): void;
/**
 * Get the revalidate duration for a cache key.
 */
declare function getRevalidateDuration(key: string): number | undefined;
//#endregion
export { ISRCacheEntry, PRERENDER_REVALIDATE_HEADER, PRERENDER_REVALIDATE_ONLY_GENERATED_HEADER, appIsrCacheKey, appIsrHtmlKey, appIsrRouteKey, appIsrRscKey, buildAppPageCacheValue, buildPagesCacheValue, getRevalidateDuration, getRevalidateSecret, isOnDemandRevalidateRequest, isRevalidateSecret, isrCacheKey, isrGet, isrSet, isrSetPrerenderedAppPage, normalizeMountedSlotsHeader, setRevalidateDuration, triggerBackgroundRegeneration };