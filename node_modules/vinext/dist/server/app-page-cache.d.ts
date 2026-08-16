import { RenderObservation } from "./cache-proof.js";
import { AppRscRenderMode } from "./app-rsc-render-mode.js";
import { CacheControlMetadata, CachedAppPageValue } from "../shims/cache-handler.js";
import { finalizeAppPageHtmlCacheResponse, finalizeAppPageRscCacheResponse, scheduleAppPageRscCacheWrite } from "./app-page-cache-finalizer.js";
import { ISRCacheEntry } from "./isr-cache.js";

//#region src/server/app-page-cache.d.ts
type AppPageDebugLogger = (event: string, detail: string) => void;
type AppPageCacheGetter = (key: string) => Promise<ISRCacheEntry | null>;
type AppPageCacheSetter = (key: string, data: CachedAppPageValue, revalidateSeconds: number, tags: string[], expireSeconds?: number) => Promise<void>;
type AppPageBackgroundRegenerator = (key: string, renderFn: () => Promise<void>) => void;
type AppPageRscCacheKeyBuilder = (pathname: string, mountedSlotsHeader?: string | null, renderMode?: AppRscRenderMode, interceptionContext?: string | null) => string;
type AppPageCacheOutcomeMetric = Readonly<{
  artifact: "html" | "rsc";
  /**
   * Internal cache lookup key for debugging and tests. Runtime telemetry sinks should hash or
   * redact this value before export to avoid high-cardinality or user-derived labels.
   */
  cacheKey: string;
  outcome: "hit" | "miss" | "stale";
  reason: "empty-entry" | "no-entry" | "non-app-page-entry" | "query-variant-unproven" | "read-error" | "served" | "stale-empty-entry";
}>;
type AppPageCacheOutcomeRecorder = (metric: AppPageCacheOutcomeMetric) => void;
type AppPageCacheRenderResult = {
  cacheControl?: CacheControlMetadata;
  html: string;
  htmlRenderObservation?: RenderObservation;
  linkHeader?: string;
  rscData: ArrayBuffer;
  rscRenderObservation?: RenderObservation;
  tags: string[];
};
type BuildAppPageCachedResponseOptions = {
  cacheControl?: CacheControlMetadata;
  cacheState: "HIT" | "STALE";
  expireSeconds?: number;
  isEdgeRuntime?: boolean;
  isRscRequest: boolean;
  middlewareHeaders?: Headers | null;
  middlewareStatus?: number | null;
  mountedSlotsHeader?: string | null;
  revalidateSeconds: number;
};
type ReadAppPageCacheResponseOptions = {
  cleanPathname: string;
  clearRequestContext: () => void;
  isEdgeRuntime?: boolean;
  isRscRequest: boolean;
  isrDebug?: AppPageDebugLogger;
  isrGet: AppPageCacheGetter;
  isrHtmlKey: (pathname: string) => string;
  isrRscKey: AppPageRscCacheKeyBuilder;
  isrSet: AppPageCacheSetter;
  interceptionContext?: string | null;
  hasRequestSearchParams?: boolean;
  middlewareHeaders?: Headers | null;
  middlewareStatus?: number | null;
  mountedSlotsHeader?: string | null;
  recordCacheOutcome?: AppPageCacheOutcomeRecorder;
  renderMode?: AppRscRenderMode;
  expireSeconds?: number;
  revalidateSeconds: number;
  renderFreshPageForCache: () => Promise<AppPageCacheRenderResult>;
  scheduleBackgroundRegeneration: AppPageBackgroundRegenerator;
};
type ReadAppPageFallbackShellCacheResponseOptions = {
  clearRequestContext: () => void;
  expireSeconds?: number;
  fallbackPathname: string;
  isEdgeRuntime?: boolean;
  isrDebug?: AppPageDebugLogger;
  isrGet: AppPageCacheGetter;
  isrHtmlKey: (pathname: string) => string;
  middlewareHeaders?: Headers | null;
  middlewareStatus?: number | null;
  revalidateSeconds: number;
  rewriteHtml: (html: string) => string;
};
declare function buildAppPageCacheTags(pathname: string, extraTags: readonly string[]): string[];
declare function buildAppPageCachedResponse(cachedValue: CachedAppPageValue, options: BuildAppPageCachedResponseOptions): Response | null;
declare function readAppPageCacheResponse(options: ReadAppPageCacheResponseOptions): Promise<Response | null>;
declare function readAppPageFallbackShellCacheResponse(options: ReadAppPageFallbackShellCacheResponseOptions): Promise<Response | null>;
//#endregion
export { AppPageCacheOutcomeMetric, buildAppPageCacheTags, buildAppPageCachedResponse, finalizeAppPageHtmlCacheResponse, finalizeAppPageRscCacheResponse, readAppPageCacheResponse, readAppPageFallbackShellCacheResponse, scheduleAppPageRscCacheWrite };