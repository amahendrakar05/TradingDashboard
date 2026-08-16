import { RenderPageEnhancers } from "./pages-document-initial-props.js";
import { PagesGetInitialPropsRouter } from "./pages-get-initial-props.js";
import { PagesPageModule } from "./pages-page-data.js";
import { ComponentType, ReactNode } from "react";

//#region src/server/pages-page-handler.d.ts
type PageRoute = {
  pattern: string;
  patternParts: string[];
  isDynamic: boolean;
  params: string[];
  module: PagesPageModule;
  filePath: string;
};
type PageRouteMatch = {
  route: PageRoute;
  params: Record<string, string | string[]>;
};
type I18nConfig = {
  locales: string[];
  defaultLocale: string;
  localeDetection?: boolean;
  domains?: Array<{
    domain: string;
    defaultLocale: string;
    locales?: string[];
    http?: true;
  }>;
} | null;
type VinextConfigSubset = {
  basePath: string;
  assetPrefix: string;
  trailingSlash: boolean;
  expireTime?: number;
  htmlLimitedBots?: string;
  clientTraceMetadata?: readonly string[];
  disableOptimizedLoading: boolean;
};
declare function shouldEmitPagesClientTraceMetadata(pageModule: PagesPageModule, appComponent: unknown): boolean;
/**
 * Options accepted by `createPagesPageHandler`.
 *
 * All `next/*`-derived functions are passed as closures from the generated
 * entry so this module avoids `next/*` imports and stays unit-testable.
 */
type CreatePagesPageHandlerOptions = {
  /** Full page route table (built by the generated entry). */pageRoutes: PageRoute[]; /** The `_error` route when present; null otherwise. */
  errorPageRoute: PageRoute | null; /** Route matcher — same function the entry uses for `matchRoute`. */
  matchRoute: (url: string, routes: PageRoute[]) => PageRouteMatch | null; /** i18n config from next.config.js, or null when i18n is not configured. */
  i18nConfig: I18nConfig; /** Subset of embedded vinextConfig used by the render pipeline. */
  vinextConfig: VinextConfigSubset; /** Build ID embedded at build time (or null in dev). */
  buildId: string | null; /** Whether the app has user-defined middleware. */
  hasMiddleware: boolean; /** Absolute file path of `pages/_app` (or null). Used for manifest lookup. */
  appAssetPath: string | null; /** Whether next.config rewrites are configured (gates Pages router readiness). */
  hasRewrites: boolean; /** `setSSRContext` from `next/router`. */
  setSSRContext: ((ctx: Record<string, unknown> | null) => void) | null;
  /**
   * `getPagesNavigationIsReadyFromSerializedState` from `next/router`. Decides
   * the initial `router.isReady` value for the Pages Router navigation
   * compat hooks (mirrors Next.js's Pages adapter readiness gate).
   */
  getPagesNavigationIsReadyFromSerializedState: ((routePattern: string | undefined, searchString: string, nextData?: Record<string, unknown>) => boolean) | null; /** `setI18nContext` from `vinext/i18n-context`. */
  setI18nContext: ((ctx: Record<string, unknown>) => void) | null; /** `wrapWithRouterContext` from `next/router`. */
  wrapWithRouterContext: ((element: ReactNode) => ReactNode) | null; /** Request-scoped `next/router` server instance. */
  router?: PagesGetInitialPropsRouter; /** `resetSSRHead` from `next/head`. */
  resetSSRHead: (() => void) | undefined; /** `getSSRHeadHTML` from `next/head`. */
  getSSRHeadHTML: (() => string) | undefined; /** `setDocumentInitialHead` from `next/head`. */
  setDocumentInitialHead: ((head: ReactNode[]) => void) | undefined; /** `flushPreloads` from `next/dynamic`. */
  flushPreloads: (() => Promise<void> | void) | undefined; /** `getSSRFontLinks` from `next/font/google`. */
  getFontLinks: () => string[]; /** Combined styles from `next/font/google` + `next/font/local`. */
  getFontStyles: () => string[]; /** Combined font preloads. */
  getFontPreloads: () => Array<{
    href: string;
    type: string;
  }>; /** `renderToReadableStream` from `react-dom/server.edge`. */
  renderToReadableStream: (element: ReactNode) => Promise<ReadableStream<Uint8Array>>; /** Render a second ISR pass to a string (wraps renderToReadableStream). */
  renderIsrPassToStringAsync: (element: ReactNode) => Promise<string>; /** `safeJsonStringify` from `vinext/html`. */
  safeJsonStringify: (value: unknown) => string; /** `sanitizeDestination` from the config-matchers module. */
  sanitizeDestination: (dest: string) => string; /** Build the React page element for a given set of page props. */
  createPageElement: (PageComponent: ComponentType, AppComponent: ComponentType | null, props: Record<string, unknown>) => ReactNode; /** Build the element with optional App/Component enhancers (for _document). */
  enhancePageElement: (PageComponent: ComponentType, AppComponent: ComponentType | null, props: Record<string, unknown>, opts: RenderPageEnhancers) => ReactNode; /** The `_app` page component (or null). */
  AppComponent: ComponentType | null; /** The `_document` page component (or null). */
  DocumentComponent: ComponentType | null;
};
type RenderPageOptions = {
  isDataReq?: boolean;
  statusCode?: number;
  asPath?: string;
  originalUrl?: string;
  renderErrorPageOnMiss?: boolean;
  __isInternalErrorRender?: boolean;
  __forcedRoute?: PageRoute;
  err?: unknown;
};
/**
 * Create the Pages Router render function (`_renderPage`).
 *
 * The returned function is self-recursive for 404/500 fallback renders and
 * accepts the same options shape the generated entry always passed inline.
 */
declare function createPagesPageHandler(opts: CreatePagesPageHandlerOptions): (request: Request, url: string, manifest: Record<string, string[]> | null | undefined, middlewareHeaders: Headers | null | undefined, options: RenderPageOptions | null | undefined) => Promise<Response>;
//#endregion
export { CreatePagesPageHandlerOptions, createPagesPageHandler, shouldEmitPagesClientTraceMetadata };