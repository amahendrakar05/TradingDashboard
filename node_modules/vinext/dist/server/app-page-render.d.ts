import { ClientReuseManifestParseResult, ClientReuseManifestSkipDisposition } from "./client-reuse-manifest.js";
import { AppOutgoingElements } from "./app-elements-wire.js";
import { NavigationContext } from "../shims/navigation-context-state.js";
import { AppPageFontPreload, AppPageSpecialError, LayoutClassificationOptions } from "./app-page-execution.js";
import { AppPageMiddlewareContext } from "./app-page-response.js";
import { AppLayoutParamAccessTracker } from "./app-layout-param-observation.js";
import { AppRscRenderMode } from "./app-rsc-render-mode.js";
import { RootParams } from "../shims/root-params.js";
import { AppPageSsrHandler } from "./app-page-stream.js";
import { CachedAppPageValue } from "../shims/cache-handler.js";
import { AppPageRenderObservationState } from "./app-page-render-observation.js";
import { ReactNode } from "react";
import { ReactFormState } from "react-dom/client";

//#region src/server/app-page-render.d.ts
type AppPageBoundaryOnError = (error: unknown, requestInfo: unknown, errorContext: unknown) => unknown;
type AppPageDebugLogger = (event: string, detail: string) => void;
type AppPageCacheSetter = (key: string, data: CachedAppPageValue, revalidateSeconds: number, tags: string[], expireSeconds?: number) => Promise<void>;
type AppPageRequestCacheLife = {
  revalidate?: number;
  expire?: number;
};
type RenderAppPageLifecycleOptions = {
  basePath?: string;
  /**
   * Allow-list of OpenTelemetry propagation keys to emit as `<meta>` tags in
   * the SSR head. From `experimental.clientTraceMetadata` in `next.config`.
   * Undefined or empty disables emission.
   */
  clientTraceMetadata?: readonly string[];
  /**
   * Maximum total length (in characters) of the preload `Link` header emitted
   * during SSR. `0` disables emission. From `reactMaxHeadersLength` in
   * `next.config`.
   */
  reactMaxHeadersLength?: number;
  cleanPathname: string;
  clearRequestContext: () => void;
  consumeDynamicUsage: () => boolean;
  peekDynamicUsage?: () => boolean;
  consumeRenderObservationState?: () => AppPageRenderObservationState; /** Read and clear any invalid dynamic usage error recorded during render (dev-only). */
  consumeInvalidDynamicUsageError?: () => unknown;
  createRscOnErrorHandler: (pathname: string, routePath: string) => AppPageBoundaryOnError;
  getFontLinks: () => string[];
  getFontPreloads: () => AppPageFontPreload[];
  getFontStyles: () => string[];
  getNavigationContext: () => NavigationContext | null;
  getPageTags: () => string[];
  getRequestCacheLife: () => AppPageRequestCacheLife | null;
  peekRequestCacheLife?: () => AppPageRequestCacheLife | null;
  getDraftModeCookieHeader: () => string | null | undefined;
  handlerStart: number;
  hasCustomGlobalError?: boolean;
  hasLoadingBoundary: boolean;
  dynamicStaleTimeSeconds?: number;
  isDynamicError: boolean;
  isDraftMode: boolean;
  isEdgeRuntime?: boolean;
  isForceDynamic: boolean;
  isForceStatic: boolean;
  isProgressiveActionRender?: boolean;
  isPrerender?: boolean;
  isSpeculativePrerender?: boolean;
  isProduction: boolean;
  probePageBeforeRender?: boolean;
  omitPendingDynamicCacheState?: boolean;
  isRscRequest: boolean;
  isrDebug?: AppPageDebugLogger;
  isrHtmlKey: (pathname: string) => string;
  isrRscKey: (pathname: string, mountedSlotsHeader?: string | null, renderMode?: AppRscRenderMode, interceptionContext?: string | null) => string;
  isrSet: AppPageCacheSetter;
  interceptionContext?: string | null;
  layoutCount: number;
  loadSsrHandler: () => Promise<AppPageSsrHandler>;
  middlewareContext: AppPageMiddlewareContext;
  navigationParams: Record<string, unknown>;
  params: Record<string, unknown>;
  pprFallbackShellSignal?: AbortSignal;
  pprFallbackShellReactSignal?: AbortSignal;
  abortPprFallbackShell?: () => void;
  rootParams?: RootParams;
  peekRenderObservationState?: () => AppPageRenderObservationState;
  probeLayoutAt: (layoutIndex: number) => unknown;
  probePage: () => unknown;
  expireSeconds?: number;
  formState?: ReactFormState | null;
  revalidateSeconds: number | null;
  renderErrorBoundaryResponse: (error: unknown, errorOrigin: "rsc" | "ssr") => Promise<Response | null>;
  renderLayoutSpecialError: (specialError: AppPageSpecialError, layoutIndex: number) => Promise<Response>;
  renderPageSpecialError: (specialError: AppPageSpecialError) => Promise<Response>;
  renderToReadableStream: (element: ReactNode | AppOutgoingElements, options: {
    onError: AppPageBoundaryOnError;
    signal?: AbortSignal;
  }) => ReadableStream<Uint8Array>;
  prerenderToReadableStream?: (element: ReactNode | AppOutgoingElements, options: {
    onError: AppPageBoundaryOnError;
    signal?: AbortSignal;
  }) => Promise<{
    prelude: ReadableStream<Uint8Array>;
  }>;
  routePattern: string;
  runWithSuppressedHookWarning<T>(probe: () => Promise<T>): Promise<T>;
  scriptNonce?: string;
  clientReuseManifest?: ClientReuseManifestParseResult;
  skipDisposition?: ClientReuseManifestSkipDisposition;
  mountedSlotsHeader?: string | null;
  renderedPathAndSearch?: string | null;
  renderMode?: AppRscRenderMode;
  waitUntil?: (promise: Promise<void>) => void;
  layoutParamAccess?: AppLayoutParamAccessTracker;
  element: ReactNode | Readonly<Record<string, ReactNode>>;
  classification?: LayoutClassificationOptions | null;
};
declare function renderAppPageLifecycle(options: RenderAppPageLifecycleOptions): Promise<Response>;
//#endregion
export { renderAppPageLifecycle };