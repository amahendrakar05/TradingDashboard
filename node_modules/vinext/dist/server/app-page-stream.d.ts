import { NavigationContext } from "../shims/navigation-context-state.js";
import { AppPageFontPreload } from "./app-page-execution.js";
import { RootParams } from "../shims/root-params.js";
import { InitialNavigationCacheMetadata } from "./app-ssr-stream.js";
import { deferUntilStreamConsumed } from "./defer-until-stream-consumed.js";
import { ReactFormState } from "react-dom/client";

//#region src/server/app-page-stream.d.ts
type AppPageFontData = {
  links: string[];
  preloads: readonly AppPageFontPreload[];
  styles: string[];
};
type CreateAppPageFontDataOptions = {
  getLinks: () => string[];
  getPreloads: () => AppPageFontPreload[];
  getStyles: () => string[];
};
type AppSsrRenderResult = {
  htmlStream: ReadableStream<Uint8Array>;
  metadataReady: Promise<void>;
  capturedRscData: Promise<ArrayBuffer> | null;
  shellErrorRecovered?: boolean;
  /**
   * Preload `Link` header value emitted by React during SSR (via `onHeaders`),
   * already capped to `reactMaxHeadersLength`. Empty/undefined when React
   * emitted no preload headers (or emission was disabled with `0`).
   */
  linkHeader?: string;
};
declare function isAppSsrRenderResult(value: unknown): value is AppSsrRenderResult;
/**
 * Combine the React-emitted preload `Link` header with vinext's font preload
 * `Link` header, capping the result to `reactMaxHeadersLength`.
 *
 * React already caps its own portion, but vinext emits font preloads through a
 * separate channel. Mirroring Next.js — where every preload flows through a
 * single capped `onHeaders` callback — we cap the *combined* header here,
 * keeping only whole entries that fit and dropping the rest once the limit is
 * exceeded. `0` disables emission entirely (matches React); `undefined` falls
 * back to the React default of 6000.
 *
 * React's hints (scripts/modules/styles) come first so that under a tight cap
 * the render-critical entries survive and trailing font preloads are dropped
 * first.
 */
declare function buildAppPageLinkHeader(reactLinkHeader: string | undefined, fontLinkHeader: string | undefined, maxHeadersLength: number | undefined): string;
type AppPageSsrHandler = {
  handleSsr: (rscStream: ReadableStream<Uint8Array>, navigationContext: NavigationContext | null, fontData: AppPageFontData, options?: {
    formState?: ReactFormState | null;
    scriptNonce?: string;
    basePath?: string;
    /**
     * Allow-list of OpenTelemetry propagation keys to emit as `<meta>` tags
     * in the SSR head. Sourced from `experimental.clientTraceMetadata`.
     */
    clientTraceMetadata?: readonly string[];
    /**
     * Maximum total length (in characters) of the preload `Link` header
     * emitted during SSR. `0` disables emission. From `reactMaxHeadersLength`
     * in `next.config`.
     */
    reactMaxHeadersLength?: number;
    rootParams?: RootParams;
    sideStream?: ReadableStream<Uint8Array>;
    capturedRscDataRef?: {
      value: Promise<ArrayBuffer> | null;
    }; /** Abort signal for a build-time PPR fallback-shell static render. */
    pprFallbackShellSignal?: AbortSignal; /** When true, wait for the full React tree before emitting bytes. */
    waitForAllReady?: boolean; /** Dev-only: original server error to surface in the browser overlay. */
    initialDevServerError?: unknown;
    /** When true, an SSR-phase-only shell render error resolves to the
     *  default `__next_error__` error-document shell (with the original
     *  flight payload and bootstrap) instead of rejecting. See handleSsr. */
    fallbackToErrorDocumentOnShellError?: boolean;
    dynamicStaleTimeSeconds?: number;
    getInitialNavigationCacheMetadata?: () => InitialNavigationCacheMetadata;
  }) => Promise<ReadableStream<Uint8Array> | AppSsrRenderResult>;
};
type RenderAppPageHtmlStreamOptions = {
  dynamicStaleTimeSeconds?: number;
  getInitialNavigationCacheMetadata?: () => InitialNavigationCacheMetadata;
  fontData: AppPageFontData;
  formState?: ReactFormState | null;
  navigationContext: NavigationContext | null;
  rscStream: ReadableStream<Uint8Array>;
  scriptNonce?: string;
  basePath?: string;
  /**
   * Allow-list of OpenTelemetry propagation keys (from
   * `experimental.clientTraceMetadata`) to surface as `<meta>` tags in
   * the SSR head. Undefined or empty disables emission.
   */
  clientTraceMetadata?: readonly string[];
  /**
   * Maximum total length (in characters) of the preload `Link` header emitted
   * during SSR. `0` disables emission. From `reactMaxHeadersLength` in
   * `next.config`.
   */
  reactMaxHeadersLength?: number;
  rootParams?: RootParams;
  ssrHandler: AppPageSsrHandler;
  /** Pre-split side stream for fused embed+capture (#981). When set,
   *  handleSsr skips its internal tee and accumulates raw RSC bytes. */
  sideStream?: ReadableStream<Uint8Array>; /** Out-parameter filled with accumulated raw RSC bytes after stream consumption. */
  capturedRscDataRef?: {
    value: Promise<ArrayBuffer> | null;
  }; /** Abort signal for a build-time PPR fallback-shell static render. */
  pprFallbackShellSignal?: AbortSignal; /** When true, wait for the full React tree before emitting bytes. */
  waitForAllReady?: boolean; /** Override the default shell-error recovery decision passed to handleSsr. */
  fallbackToErrorDocumentOnShellError?: boolean; /** Dev-only: original server error to surface in the browser overlay. */
  initialDevServerError?: unknown;
  /** True when the app supplies a custom global-error.tsx. Disables the
   *  default error-document shell fallback so SSR shell errors keep driving
   *  the server-rendered global-error boundary re-render. */
  hasCustomGlobalError?: boolean;
};
type RenderAppPageHtmlResponseOptions = {
  clearRequestContext: () => void;
  fontLinkHeader?: string;
  isEdgeRuntime?: boolean;
  middlewareHeaders?: Headers | null;
  status: number;
} & RenderAppPageHtmlStreamOptions;
type AppPageHtmlStreamRecoveryResult = {
  htmlStream: ReadableStream<Uint8Array> | null;
  response: Response | null;
  metadataReady: Promise<void>;
  capturedRscData: Promise<ArrayBuffer> | null;
  shellErrorRecovered: boolean; /** React-emitted preload `Link` header (already capped). */
  linkHeader?: string;
};
type RenderAppPageHtmlStreamWithRecoveryOptions<TSpecialError> = {
  onShellRendered?: () => void;
  renderErrorBoundaryResponse: (error: unknown) => Promise<Response | null>;
  renderHtmlStream: () => Promise<ReadableStream<Uint8Array> | AppSsrRenderResult>;
  renderSpecialErrorResponse: (specialError: TSpecialError) => Promise<Response>;
  resolveSpecialError: (error: unknown) => TSpecialError | null;
};
type AppPageRscErrorTracker = {
  getCapturedError: () => unknown;
  /**
   * Returns a NEXT_REDIRECT or NEXT_HTTP_ERROR_FALLBACK error captured during
   * the RSC render. Read after the SSR shell promise resolves to swap a
   * 307/404 in place of the streamed body when redirect()/notFound() throws
   * synchronously inside a route-level Suspense boundary (loading.tsx).
   */
  getCapturedSpecialError: () => unknown;
  onRenderError: (error: unknown, requestInfo: unknown, errorContext: unknown) => unknown;
};
declare function createAppPageFontData(options: CreateAppPageFontDataOptions): AppPageFontData;
declare function renderAppPageHtmlStream(options: RenderAppPageHtmlStreamOptions): Promise<AppSsrRenderResult>;
declare function renderAppPageHtmlResponse(options: RenderAppPageHtmlResponseOptions): Promise<Response>;
declare function renderAppPageHtmlStreamWithRecovery<TSpecialError>(options: RenderAppPageHtmlStreamWithRecoveryOptions<TSpecialError>): Promise<AppPageHtmlStreamRecoveryResult>;
declare function createAppPageRscErrorTracker(baseOnError: (error: unknown, requestInfo: unknown, errorContext: unknown) => unknown): AppPageRscErrorTracker;
//#endregion
export { AppPageFontData, AppPageSsrHandler, AppSsrRenderResult, buildAppPageLinkHeader, createAppPageFontData, createAppPageRscErrorTracker, deferUntilStreamConsumed, isAppSsrRenderResult, renderAppPageHtmlResponse, renderAppPageHtmlStream, renderAppPageHtmlStreamWithRecovery };