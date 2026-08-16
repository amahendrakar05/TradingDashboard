import { NavigationContext } from "../shims/navigation-context-state.js";
import { AppPageFontPreload } from "./app-page-execution.js";
import { RootParams } from "../shims/root-params.js";
import { AppPageSsrHandler } from "./app-page-stream.js";
import { CacheControlMetadata } from "../shims/cache-handler.js";
import { createAppPageRenderObservation } from "./app-page-render-observation.js";
import { ReactNode } from "react";

//#region src/server/app-page-cache-render.d.ts
type AppPageRenderableElement = ReactNode | Record<string, ReactNode>;
type AppPageCacheRoute = {
  pattern: string;
  routeSegments: readonly string[];
};
type RenderAppPageCacheArtifactsOptions = {
  basePath?: string;
  captureRscData: boolean;
  cleanPathname: string;
  clientTraceMetadata?: readonly string[];
  element: AppPageRenderableElement;
  getFontLinks: () => string[];
  getFontPreloads: () => AppPageFontPreload[];
  getFontStyles: () => string[];
  getNavigationContext: () => NavigationContext | null;
  loadSsrHandler: () => Promise<AppPageSsrHandler>;
  mountedSlotsHeader?: string | null;
  navigationParams: Record<string, unknown>;
  onError: (error: unknown, requestInfo: unknown, errorContext: unknown) => unknown;
  reactMaxHeadersLength?: number;
  renderToReadableStream: (element: AppPageRenderableElement, options: {
    onError: (error: unknown, requestInfo: unknown, errorContext: unknown) => unknown;
  }) => ReadableStream<Uint8Array>;
  rootParams?: RootParams;
  route: AppPageCacheRoute;
  waitForAllReady?: boolean;
};
type RenderAppPageCacheArtifactsResult = {
  cacheControl?: CacheControlMetadata;
  html: string;
  htmlRenderObservation: ReturnType<typeof createAppPageRenderObservation>;
  linkHeader?: string;
  rscData?: ArrayBuffer;
  rscRenderObservation?: ReturnType<typeof createAppPageRenderObservation>;
  tags: string[];
};
/**
 * Render an App page element to HTML (and optionally its RSC payload) for cache
 * storage. Combines the RSC stream, SSR handler, observation consumption, and
 * cache-tag construction used by both normal ISR revalidation and PPR fallback
 * shell regeneration.
 */
declare function renderAppPageCacheArtifacts(options: RenderAppPageCacheArtifactsOptions): Promise<RenderAppPageCacheArtifactsResult>;
//#endregion
export { RenderAppPageCacheArtifactsOptions, RenderAppPageCacheArtifactsResult, renderAppPageCacheArtifacts };