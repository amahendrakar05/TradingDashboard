import { MetadataFileRoute } from "./metadata-routes.js";
import { AppElements } from "./app-elements-wire.js";
import { NavigationContext } from "../shims/navigation-context-state.js";
import { AppPageParams } from "./app-page-boundary.js";
import { AppPageFontPreload } from "./app-page-execution.js";
import { AppPageMiddlewareContext } from "./app-page-response.js";
import { ApplyAppPageFileBasedMetadata } from "./app-page-head.js";
import { AppPageRouteWiringRoute } from "./app-page-route-wiring.js";
import { AppPageInterceptOptions } from "./app-page-element-builder.js";
import { AppPageSsrHandler } from "./app-page-stream.js";
import { ComponentType, ReactNode } from "react";

//#region src/server/app-page-boundary-render.d.ts
type AppPageComponent = ComponentType<any>;
type AppPageModule = Record<string, unknown> & {
  default?: AppPageComponent | null | undefined;
};
type AppPageBoundaryOnError = (error: unknown, requestInfo: unknown, errorContext: unknown) => unknown;
type AppPageBoundaryRoute<TModule extends AppPageModule = AppPageModule> = {
  error?: TModule | null;
  errorPaths?: readonly TModule[] | null;
  errors?: readonly (TModule | null | undefined)[] | null;
  forbidden?: TModule | null;
  forbiddenTreePosition?: number | null;
  forbiddens?: readonly (TModule | null | undefined)[] | null;
  layoutTreePositions?: readonly number[] | null;
  layouts?: readonly (TModule | null | undefined)[];
  notFound?: TModule | null;
  notFounds?: readonly (TModule | null | undefined)[] | null;
  notFoundTreePosition?: number | null;
  params?: AppPageParams;
  pattern?: string;
  routeSegments?: readonly string[];
  slots?: AppPageRouteWiringRoute<TModule>["slots"];
  unauthorized?: TModule | null;
  unauthorizedTreePosition?: number | null;
  unauthorizeds?: readonly (TModule | null | undefined)[] | null;
};
type AppPageBoundaryRenderCommonOptions<TModule extends AppPageModule = AppPageModule> = {
  applyFileBasedMetadata?: ApplyAppPageFileBasedMetadata;
  buildFontLinkHeader: (preloads: readonly AppPageFontPreload[] | null | undefined) => string;
  clearRequestContext: () => void;
  createRscOnErrorHandler: (pathname: string, routePath: string) => AppPageBoundaryOnError;
  getAndClearPendingCookies?: () => string[];
  getFontLinks: () => string[];
  getFontPreloads: () => AppPageFontPreload[];
  getFontStyles: () => string[];
  getNavigationContext: () => NavigationContext | null;
  globalErrorModule?: TModule | null;
  isEdgeRuntime?: boolean;
  isRscRequest: boolean;
  loadSsrHandler: () => Promise<AppPageSsrHandler>;
  makeThenableParams: (params: AppPageParams) => unknown;
  middlewareContext: AppPageMiddlewareContext;
  metadataRoutes: MetadataFileRoute[];
  /**
   * Whether metadata-origin redirects should ride as a 200 streaming response
   * (HTML meta-refresh / RSC flight) rather than a blocking 307. Mirrors the
   * matched-page dispatch decision `shouldServeStreamingMetadata(userAgent,
   * htmlLimitedBots)`: html-limited bots get the blocking 307, so a
   * `generateMetadata()` redirect thrown from a fallback boundary matches the
   * matched-page path instead of always defaulting to streaming. Undefined
   * means "not computed" and is treated as streaming, preserving prior behavior
   * for callers that never hit metadata redirects.
   */
  serveStreamingMetadata?: boolean; /** Configured next.config `basePath`, threaded into file-based metadata href emission. */
  basePath?: string; /** Configured next.config `trailingSlash`, threaded into canonical URL rendering. */
  trailingSlash?: boolean;
  renderToReadableStream: (element: ReactNode | AppElements, options: {
    onError: AppPageBoundaryOnError;
  }) => ReadableStream<Uint8Array>;
  request: Request;
  requestUrl: string;
  resolveChildSegments: (routeSegments: readonly string[], treePosition: number, params: AppPageParams) => string[];
  rootLayouts: readonly (TModule | null | undefined)[];
  scriptNonce?: string;
  sourcePageSegments?: readonly string[] | null;
};
type RenderAppPageHttpAccessFallbackOptions<TModule extends AppPageModule = AppPageModule> = {
  boundaryComponent?: AppPageComponent | null;
  boundaryModule?: TModule | null;
  intercept?: AppPageInterceptOptions<TModule> | null;
  layoutModules?: readonly (TModule | null | undefined)[] | null;
  matchedParams: AppPageParams;
  rootForbiddenModule?: TModule | null;
  rootNotFoundModule?: TModule | null;
  rootUnauthorizedModule?: TModule | null; /** Normalized, basePath-free application pathname used for route matching. */
  routePathname?: string;
  route?: AppPageBoundaryRoute<TModule> | null;
  /**
   * When true, the resolved boundary is rendered without wrapping it in the
   * route's layouts. Used by `global-not-found.tsx`, which provides its own
   * `<html>`/`<body>` and intentionally replaces the root layout.
   * Mirrors Next.js's `createNotFoundLoaderTree` behavior for `hasGlobalNotFound`.
   * @see https://github.com/vercel/next.js/blob/canary/packages/next/src/server/app-render/app-render.tsx#L495-L520
   */
  skipLayoutWrapping?: boolean;
  statusCode: number;
} & AppPageBoundaryRenderCommonOptions<TModule>;
type RenderAppPageErrorBoundaryOptions<TModule extends AppPageModule = AppPageModule> = {
  error: unknown;
  errorOrigin?: "rsc" | "ssr";
  matchedParams?: AppPageParams | null;
  route?: AppPageBoundaryRoute<TModule> | null;
  sanitizeErrorForClient: (error: Error) => Error;
} & AppPageBoundaryRenderCommonOptions<TModule>;
declare function renderAppPageHttpAccessFallback<TModule extends AppPageModule>(options: RenderAppPageHttpAccessFallbackOptions<TModule>): Promise<Response | null>;
declare function renderAppPageErrorBoundary<TModule extends AppPageModule>(options: RenderAppPageErrorBoundaryOptions<TModule>): Promise<Response | null>;
//#endregion
export { AppPageBoundaryRoute, renderAppPageErrorBoundary, renderAppPageHttpAccessFallback };