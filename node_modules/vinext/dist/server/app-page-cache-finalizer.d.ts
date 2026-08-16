import { RenderObservation } from "./cache-proof.js";
import { AppRscRenderMode } from "./app-rsc-render-mode.js";
import { CachedAppPageValue } from "../shims/cache-handler.js";
import { AppPageRenderObservationState } from "./app-page-render-observation.js";

//#region src/server/app-page-cache-finalizer.d.ts
type AppPageDebugLogger = (event: string, detail: string) => void;
type AppPageCacheSetter = (key: string, data: CachedAppPageValue, revalidateSeconds: number, tags: string[], expireSeconds?: number) => Promise<void>;
type AppPageRscCacheKeyBuilder = (pathname: string, mountedSlotsHeader?: string | null, renderMode?: AppRscRenderMode, interceptionContext?: string | null) => string;
type AppPageRequestCacheLife = {
  revalidate?: number;
  expire?: number;
};
type BuildAppPageCacheRenderObservation = (input: {
  cacheTags: readonly string[];
  state: AppPageRenderObservationState;
}) => RenderObservation;
type FinalizeAppPageHtmlCacheResponseOptions = {
  capturedDynamicUsageBeforeContextCleanup?: () => boolean;
  capturedRscDataPromise: Promise<ArrayBuffer> | null;
  cleanPathname: string;
  consumeDynamicUsage: () => boolean;
  consumeRenderObservationState?: () => AppPageRenderObservationState;
  createHtmlRenderObservation?: BuildAppPageCacheRenderObservation;
  createRscRenderObservation?: BuildAppPageCacheRenderObservation;
  getPageTags: () => string[];
  getRequestCacheLife?: () => AppPageRequestCacheLife | null;
  isrDebug?: AppPageDebugLogger;
  isrHtmlKey: (pathname: string) => string;
  isrRscKey: AppPageRscCacheKeyBuilder;
  isrSet: AppPageCacheSetter;
  interceptionContext?: string | null;
  omitPendingDynamicCacheState?: boolean;
  preserveClientResponseHeaders?: boolean;
  expireSeconds?: number;
  revalidateSeconds: number | null;
  waitUntil?: (promise: Promise<void>) => void;
};
type ScheduleAppPageRscCacheWriteOptions = {
  capturedRscDataPromise: Promise<ArrayBuffer> | null;
  cleanPathname: string;
  consumeDynamicUsage: () => boolean;
  consumeRenderObservationState?: () => AppPageRenderObservationState;
  createRscRenderObservation?: BuildAppPageCacheRenderObservation;
  dynamicUsedDuringBuild: boolean;
  getPageTags: () => string[];
  getRequestCacheLife?: () => AppPageRequestCacheLife | null;
  isrDebug?: AppPageDebugLogger;
  isrRscKey: AppPageRscCacheKeyBuilder;
  isrSet: AppPageCacheSetter;
  interceptionContext?: string | null;
  mountedSlotsHeader?: string | null;
  omitPendingDynamicCacheState?: boolean;
  renderMode?: AppRscRenderMode;
  preserveClientResponseHeaders?: boolean;
  expireSeconds?: number;
  revalidateSeconds: number | null;
  waitUntil?: (promise: Promise<void>) => void;
};
declare function finalizeAppPageHtmlCacheResponse(response: Response, options: FinalizeAppPageHtmlCacheResponseOptions): Response;
declare function finalizeAppPageRscCacheResponse(response: Response, options: ScheduleAppPageRscCacheWriteOptions): Response;
declare function scheduleAppPageRscCacheWrite(options: ScheduleAppPageRscCacheWriteOptions): boolean;
//#endregion
export { finalizeAppPageHtmlCacheResponse, finalizeAppPageRscCacheResponse, scheduleAppPageRscCacheWrite };