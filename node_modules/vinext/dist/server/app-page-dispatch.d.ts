import { ClassificationReason } from "../build/layout-classification-types.js";
import { ClientReuseManifestParseResult } from "./client-reuse-manifest.js";
import { AppOutgoingElements } from "./app-elements-wire.js";
import { NavigationContext } from "../shims/navigation-context-state.js";
import { AppPageFontPreload, LayoutClassificationOptions } from "./app-page-execution.js";
import { AppPageMiddlewareContext } from "./app-page-response.js";
import { AppLayoutParamAccessTracker } from "./app-layout-param-observation.js";
import { AppRscRenderMode } from "./app-rsc-render-mode.js";
import { RootParams } from "../shims/root-params.js";
import { AppPageSsrHandler } from "./app-page-stream.js";
import { CachedAppPageValue } from "../shims/cache-handler.js";
import { ISRCacheEntry } from "./isr-cache.js";
import { PprFallbackShellState } from "../shims/ppr-fallback-shell.js";
import { FetchCacheMode } from "../shims/fetch-cache.js";
import { AppPagePprFallbackCacheShell } from "./app-ppr-fallback-shell.js";
import { WarmPprFallbackShellCachesOptions } from "./app-ppr-fallback-shell-render.js";
import { ValidateAppPageDynamicParamsOptions } from "./app-page-request.js";
import { ReactNode } from "react";
import { ReactFormState } from "react-dom/client";

//#region src/server/app-page-dispatch.d.ts
type AppPageParams = Record<string, string | string[]>;
type AppPageElement = ReactNode | Readonly<Record<string, ReactNode>>;
type AppPageRenderableElement = ReactNode | AppOutgoingElements;
type AppPageBoundaryOnError = (error: unknown, requestInfo: unknown, errorContext: unknown) => unknown;
type AppPageDebugLogger = (event: string, detail: string) => void;
type AppPageCacheSetter = (key: string, data: CachedAppPageValue, revalidateSeconds: number, tags: string[], expireSeconds?: number) => Promise<void>;
type AppPageCacheGetter = (key: string) => Promise<ISRCacheEntry | null>;
type AppPageBackgroundRegenerationErrorContext = {
  routerKind: "App Router";
  routePath: string;
  routeType: "render";
};
type AppPageBackgroundRegenerator = (key: string, renderFn: () => Promise<void>, errorContext?: AppPageBackgroundRegenerationErrorContext) => void;
type AppPageDispatchIntercept<TPage = unknown> = {
  interceptLayouts?: readonly unknown[] | null;
  interceptLayoutSegments?: readonly (readonly string[])[] | null;
  interceptBranchSegments?: readonly string[] | null;
  interceptNotFoundBranchSegments?: readonly string[] | null;
  notFound?: unknown;
  notFoundTreePosition?: number | null;
  matchedParams: AppPageParams;
  sourceMatchedParams?: AppPageParams;
  page: TPage;
  slotId?: string | null;
  slotKey: string;
  sourceRouteIndex: number;
  sourcePageSegments?: readonly string[] | null;
};
type AppPageDispatchInterceptOptions<TPage = unknown> = {
  interceptionContext: string | null;
  interceptLayouts?: readonly unknown[] | null;
  interceptLayoutSegments?: readonly (readonly string[])[] | null;
  interceptBranchSegments?: readonly string[] | null;
  interceptNotFoundBranchSegments?: readonly string[] | null;
  interceptNotFound?: unknown;
  interceptNotFoundTreePosition?: number | null;
  interceptPage: TPage;
  interceptParams: AppPageParams;
  interceptSlotId?: string | null;
  interceptSlotKey: string;
  interceptSourceMatchedUrl?: string | null;
  interceptSourcePageSegments?: readonly string[] | null;
};
type AppPageModule = {
  default?: unknown;
  dynamic?: unknown;
  revalidate?: unknown;
};
type AppPageDispatchSlot = {
  default?: AppPageModule | null;
  page?: AppPageModule | null;
  slotPatternParts?: readonly string[] | null;
  slotParamNames?: readonly string[] | null;
};
type AppPageDispatchRoute = {
  __buildTimeClassifications?: LayoutClassificationOptions["buildTimeClassifications"];
  __buildTimeReasons?: LayoutClassificationOptions["buildTimeReasons"];
  error?: AppPageModule | null;
  errors?: readonly (AppPageModule | null | undefined)[];
  forbidden?: AppPageModule | null;
  forbiddenTreePosition?: number | null;
  forbiddens?: readonly (AppPageModule | null | undefined)[];
  isDynamic: boolean;
  layouts: readonly AppPageModule[];
  layoutTreePositions?: readonly number[];
  loading?: AppPageModule | null;
  notFound?: AppPageModule | null;
  notFounds?: readonly (AppPageModule | null | undefined)[];
  params: readonly string[];
  pattern: string;
  routeSegments: readonly string[];
  slots?: Readonly<Record<string, AppPageDispatchSlot>>;
  unauthorized?: AppPageModule | null;
  unauthorizedTreePosition?: number | null;
  unauthorizeds?: readonly (AppPageModule | null | undefined)[];
};
type AppPagePprRuntime<TRoute extends AppPageDispatchRoute> = {
  beginFinalRender(state: AppPagePprState): void;
  getState(): AppPagePprState | null;
  run<T>(shell: NonNullable<DispatchAppPageOptions<TRoute>["pprFallbackShell"]>, fn: () => T): T;
  tryServe(options: DispatchAppPageOptions<TRoute>, currentRevalidateSeconds: number | null, isDraftMode: boolean, isForceStatic: boolean, isForceDynamic: boolean): Promise<Response | null>;
  warm(options: WarmPprFallbackShellCachesOptions): Promise<void>;
};
type AppPagePprState = PprFallbackShellState;
type DispatchAppPageOptions<TRoute extends AppPageDispatchRoute> = {
  /** Configured basePath (e.g. "/blog"). Used to prefix redirect Locations. */basePath?: string;
  /**
   * Allow-list of OpenTelemetry propagation keys (from
   * `experimental.clientTraceMetadata`) to surface as `<meta>` tags in the
   * SSR head. Undefined or empty disables emission entirely.
   */
  clientTraceMetadata?: readonly string[];
  /**
   * Maximum total length (in characters) of the preload `Link` header emitted
   * during SSR. `0` disables emission. From `reactMaxHeadersLength` in
   * `next.config`. Undefined falls back to the React default downstream.
   */
  reactMaxHeadersLength?: number;
  buildPageElement: (route: TRoute, params: AppPageParams, opts: AppPageDispatchInterceptOptions | undefined, searchParams: URLSearchParams, layoutParamAccess?: AppLayoutParamAccessTracker, options?: {
    observeMetadataSearchParamsAccess?: boolean;
    observePageSearchParamsAccess?: boolean;
    serveStreamingMetadata?: boolean;
  }) => Promise<AppPageElement>;
  clientReuseManifest?: ClientReuseManifestParseResult;
  cleanPathname: string;
  displayPathname?: string;
  clearRequestContext: () => void;
  createRscOnErrorHandler: (pathname: string, routePath: string) => AppPageBoundaryOnError;
  debugClassification?: (layoutId: string, reason: ClassificationReason) => void;
  draftModeSecret: string;
  dynamicConfig?: string;
  dynamicStaleTimeSeconds?: number;
  dynamicParamsConfig?: boolean;
  /**
   * Hydrate a source route's lazy page/route-handler modules before reading
   * `route.page` (e.g. for fetch-cache-mode resolution) on intercept and ISR
   * revalidation targets obtained via `getSourceRoute`. Idempotent.
   */
  ensureRouteLoaded?: (route: TRoute) => unknown;
  fetchCache?: FetchCacheMode | null;
  findIntercept: (pathname: string) => AppPageDispatchIntercept | null;
  formState?: ReactFormState | null;
  actionError?: unknown;
  actionFailed?: boolean;
  generateStaticParams?: ValidateAppPageDynamicParamsOptions["generateStaticParams"];
  getFontLinks: () => string[];
  getFontPreloads: () => AppPageFontPreload[];
  getFontStyles: () => string[];
  getNavigationContext: () => NavigationContext | null;
  getSourceRoute: (sourceRouteIndex: number) => TRoute | undefined;
  hasGenerateStaticParams: boolean;
  hasCustomGlobalError?: boolean;
  hasPageDefaultExport: boolean;
  hasPageModule: boolean;
  handlerStart: number;
  htmlLimitedBots?: string;
  interceptionContext: string | null;
  isEdgeRuntime?: boolean;
  isProgressiveActionRender?: boolean;
  isProduction: boolean;
  isRscRequest: boolean;
  isrDebug?: AppPageDebugLogger;
  isrGet: AppPageCacheGetter;
  isrHtmlKey: (pathname: string) => string;
  isrRscKey: (pathname: string, mountedSlotsHeader?: string | null, renderMode?: AppRscRenderMode, interceptionContext?: string | null) => string;
  isrSet: AppPageCacheSetter;
  loadSsrHandler: () => Promise<AppPageSsrHandler>;
  middlewareContext: AppPageMiddlewareContext;
  mountedSlotsHeader?: string | null;
  params: AppPageParams;
  pprFallbackCacheShells?: readonly AppPagePprFallbackCacheShell[] | null;
  pprFallbackShell?: {
    fallbackParamNames: readonly string[];
    routePattern: string;
  };
  pprRuntime?: AppPagePprRuntime<TRoute>;
  /**
   * Set of concrete URL paths that were pre-rendered at build time for this
   * route. When the exact cache entry for a known pregenerated path is absent
   * (evicted, stale-empty, cold start, read error), the fallback shell must
   * NOT be served — the route is a valid generated route whose cache merely
   * has a transient gap. Falls through to a fresh render instead.
   */
  renderedConcreteUrlPaths?: ReadonlySet<string>;
  skipStaticParamsValidation?: boolean;
  staticParamsValidationParams?: AppPageParams;
  rootParams?: RootParams;
  probeLayoutAt: (layoutIndex: number, layoutParamAccess?: AppLayoutParamAccessTracker) => unknown;
  probePage: (searchParams?: URLSearchParams) => unknown;
  expireSeconds?: number;
  renderErrorBoundaryPage: (error: unknown, errorOrigin?: "rsc" | "ssr") => Promise<Response | null>;
  renderHttpAccessFallbackPage: (statusCode: number, opts: {
    boundaryComponent?: unknown;
    boundaryModule?: AppPageModule | null;
    intercept?: AppPageDispatchInterceptOptions | null;
    layouts?: readonly AppPageModule[];
    matchedParams: AppPageParams;
  }, middlewareContext: AppPageMiddlewareContext | null) => Promise<Response | null>;
  renderToReadableStream: (element: AppPageRenderableElement, options: {
    onError: AppPageBoundaryOnError;
    signal?: AbortSignal;
  }) => ReadableStream<Uint8Array>;
  prerenderToReadableStream?: (element: AppPageRenderableElement, options: {
    onError: AppPageBoundaryOnError;
    signal?: AbortSignal;
  }) => Promise<{
    prelude: ReadableStream<Uint8Array>;
  }>;
  request: Request;
  revalidateSeconds: number | null;
  renderedPathAndSearch?: string | null;
  resolveRouteFetchCacheMode?: (route: TRoute) => FetchCacheMode | null;
  resolveRouteDynamicConfig?: (route: TRoute) => string | null | undefined;
  rootForbiddenModule?: AppPageModule | null;
  rootNotFoundModule?: AppPageModule | null;
  rootUnauthorizedModule?: AppPageModule | null;
  route: TRoute;
  runWithSuppressedHookWarning<T>(probe: () => Promise<T>): Promise<T>;
  scheduleBackgroundRegeneration: AppPageBackgroundRegenerator;
  scriptNonce?: string;
  searchParams: URLSearchParams;
  setNavigationContext: (context: {
    params: AppPageParams;
    pathname: string;
    searchParams: URLSearchParams;
  }) => void;
  renderMode?: AppRscRenderMode;
};
declare function shouldReadAppPageCache(options: {
  isProgressiveActionRender: boolean;
  isDraftMode: boolean;
  isForceDynamic: boolean;
  isProduction: boolean;
  isRscRequest: boolean;
  revalidateSeconds: number | null;
  scriptNonce?: string;
}): boolean;
declare function hasSearchParams(searchParams: URLSearchParams | null | undefined): boolean;
declare function dispatchAppPage<TRoute extends AppPageDispatchRoute>(options: DispatchAppPageOptions<TRoute>): Promise<Response>;
//#endregion
export { AppPageBoundaryOnError, AppPageDispatchRoute, AppPagePprRuntime, AppPagePprState, AppPageRenderableElement, DispatchAppPageOptions, dispatchAppPage, hasSearchParams, shouldReadAppPageCache };