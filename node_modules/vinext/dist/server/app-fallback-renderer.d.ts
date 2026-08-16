import { MetadataFileRoute } from "./metadata-routes.js";
import { AppElements } from "./app-elements-wire.js";
import { NavigationContext } from "../shims/navigation-context-state.js";
import { AppPageParams } from "./app-page-boundary.js";
import { AppPageFontPreload } from "./app-page-execution.js";
import { AppPageMiddlewareContext } from "./app-page-response.js";
import { ApplyAppPageFileBasedMetadata } from "./app-page-head.js";
import { AppPageInterceptOptions } from "./app-page-element-builder.js";
import { AppPageSsrHandler } from "./app-page-stream.js";
import { AppPageBoundaryRoute } from "./app-page-boundary-render.js";
import { ReactNode } from "react";

//#region src/server/app-fallback-renderer.d.ts
type AppPageComponent = import("react").ComponentType<any>;
type AppPageModule = Record<string, unknown> & {
  default?: AppPageComponent | null | undefined;
};
type AppPageBoundaryOnError = (error: unknown, requestInfo: unknown, errorContext: unknown) => unknown;
type AppFallbackRendererRootBoundaries<TModule extends AppPageModule = AppPageModule> = {
  rootForbiddenModule?: TModule | null;
  rootLayouts: readonly (TModule | null | undefined)[];
  rootNotFoundModule?: TModule | null;
  rootUnauthorizedModule?: TModule | null;
};
type AppFallbackRendererFontProviders = {
  buildFontLinkHeader: (preloads: readonly AppPageFontPreload[] | null | undefined) => string;
  getFontLinks: () => string[];
  getFontPreloads: () => AppPageFontPreload[];
  getFontStyles: () => string[];
};
type AppFallbackRendererOptions<TModule extends AppPageModule = AppPageModule> = {
  applyFileBasedMetadata?: ApplyAppPageFileBasedMetadata;
  clearRequestContext: () => void;
  createRscOnErrorHandler: (request: Request, pathname: string, routePath: string) => AppPageBoundaryOnError;
  fontProviders: AppFallbackRendererFontProviders;
  getAndClearPendingCookies?: () => string[];
  getNavigationContext: () => NavigationContext | null;
  globalErrorModule?: TModule | null; /** Whether experimental.globalNotFound is enabled for route-miss 404s. */
  globalNotFoundEnabled?: boolean;
  /**
   * Loader for the user's `app/global-not-found.tsx` module. When provided,
   * route-miss 404s render this module as a standalone document (skipping the
   * root layout) because it ships its own `<html>` and `<body>`. Page-triggered
   * `notFound()` calls continue to use the regular `not-found.tsx` boundary
   * inside layouts.
   *
   * Passed as a deferred loader (rather than the resolved module) so the
   * generated RSC entry can use `() => import(...)` for chunk isolation.
   * Without that isolation, the bundler co-locates global-not-found's CSS
   * with the root layout's CSS in a single chunk and the CSS minifier
   * (lightningcss) drops overlapping declarations as dead code — breaking
   * the cascade for route-miss 404s where only global-not-found is rendered.
   *
   * @see https://github.com/vercel/next.js/blob/canary/packages/next/src/server/app-render/app-render.tsx
   * @see Next.js test: test/e2e/app-dir/initial-css-order/initial-css-order.test.ts
   */
  loadGlobalNotFoundModule?: (() => Promise<TModule | null | undefined>) | null;
  makeThenableParams: (params: AppPageParams) => unknown;
  metadataRoutes: MetadataFileRoute[]; /** Configured next.config `basePath`, threaded into file-based metadata href emission. */
  basePath?: string; /** Configured next.config `trailingSlash`, threaded into canonical URL rendering. */
  trailingSlash?: boolean;
  /**
   * Serialized next.config `htmlLimitedBots` regexp source. Used to decide, per
   * request user-agent, whether a `generateMetadata()` redirect thrown from a
   * fallback boundary should stream (200) or block (307) — matching the
   * matched-page dispatch path via `shouldServeStreamingMetadata`.
   */
  htmlLimitedBots?: string;
  resolveChildSegments: (routeSegments: readonly string[], treePosition: number, params: AppPageParams) => string[];
  rootBoundaries: AppFallbackRendererRootBoundaries<TModule>;
  rscRenderer: (element: ReactNode | AppElements, options: {
    onError: AppPageBoundaryOnError;
  }) => ReadableStream<Uint8Array>;
  sanitizer: (error: Error) => Error;
  ssrLoader: () => Promise<AppPageSsrHandler>;
};
type AppFallbackRendererCallContext = {
  /**
   * Whether the matched (or invoking) route opts into Next.js' edge runtime via
   * `export const runtime = "edge"`. Propagated so boundary/error/not-found
   * responses carry `x-edge-runtime: 1` for edge routes, matching the page
   * render path. Defaults to `false` when no route is matched.
   */
  isEdgeRuntime?: boolean;
  routePathname?: string;
  sourcePageSegments?: readonly string[] | null;
};
type AppFallbackRenderer<TModule extends AppPageModule = AppPageModule> = {
  renderErrorBoundary: (route: AppPageBoundaryRoute<TModule> | null, error: unknown, isRscRequest: boolean, request: Request, matchedParams: AppPageParams | undefined, scriptNonce: string | undefined, middlewareContext: AppPageMiddlewareContext, callContext?: AppFallbackRendererCallContext, errorOrigin?: "rsc" | "ssr") => Promise<Response | null>;
  renderHttpAccessFallback: (route: AppPageBoundaryRoute<TModule> | null, statusCode: number, isRscRequest: boolean, request: Request, opts: {
    boundaryComponent?: AppPageComponent | null;
    boundaryModule?: TModule | null;
    intercept?: AppPageInterceptOptions<TModule> | null;
    layouts?: readonly (TModule | null | undefined)[] | null;
    matchedParams?: AppPageParams;
  }, scriptNonce: string | undefined, middlewareContext: AppPageMiddlewareContext, callContext?: AppFallbackRendererCallContext) => Promise<Response | null>;
  renderNotFound: (route: AppPageBoundaryRoute<TModule> | null, isRscRequest: boolean, request: Request, matchedParams: AppPageParams | undefined, scriptNonce: string | undefined, middlewareContext: AppPageMiddlewareContext, callContext?: AppFallbackRendererCallContext) => Promise<Response | null>;
};
declare function createAppFallbackRenderer<TModule extends AppPageModule>(options: AppFallbackRendererOptions<TModule>): AppFallbackRenderer<TModule>;
//#endregion
export { createAppFallbackRenderer };