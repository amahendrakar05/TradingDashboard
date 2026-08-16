import { NextHeader, NextI18nConfig, NextRedirect, NextRewrite } from "../config/next-config.js";
import { ImageConfig } from "./image-optimization.js";
import { ClientReuseManifestParseResult } from "./client-reuse-manifest.js";
import { AppRscRenderMode } from "./app-rsc-render-mode.js";
import { RootParams } from "../shims/root-params.js";
import { AppMiddlewareContext, ApplyAppMiddlewareResult } from "./app-middleware.js";
import { AppPagePprFallbackCacheShell } from "./app-ppr-fallback-shell.js";
import { AppPrerenderRootParamNamesMap, AppPrerenderStaticParamsMap } from "./app-prerender-endpoints.js";
import { AppRouteTreePrefetchRoute, PrefetchInliningConfig } from "./app-route-tree-prefetch.js";
import { ReactFormState } from "react-dom/client";

//#region src/server/app-rsc-handler.d.ts
type AppPageParams = Record<string, string | string[]>;
type StaticParamsMap = AppPrerenderStaticParamsMap;
type RootParamNamesMap = AppPrerenderRootParamNamesMap;
type AppRscMiddlewareContext = AppMiddlewareContext;
type RunAppMiddlewareOptions = {
  cleanPathname: string;
  context: AppRscMiddlewareContext;
  hadBasePath: boolean;
  isDataRequest: boolean;
  request: Request;
};
type AppRscHandlerRoute = {
  __loadPage?: unknown;
  __loadRouteHandler?: unknown;
  isDynamic: boolean;
  layouts?: readonly unknown[];
  layoutTreePositions?: readonly number[];
  params?: readonly string[];
  page?: unknown;
  pattern: string;
  rootParamNames?: readonly string[];
  routeHandler?: unknown;
  routeSegments: readonly string[];
  slots?: AppRouteTreePrefetchRoute["slots"];
};
type AppRscRouteMatch<TRoute> = {
  params: AppPageParams;
  route: TRoute;
};
type DispatchMatchedPageOptions<TRoute> = {
  clientReuseManifest: ClientReuseManifestParseResult;
  cleanPathname: string;
  displayPathname: string;
  formState: ReactFormState | null;
  actionError?: unknown;
  actionFailed?: boolean;
  handlerStart: number;
  interceptionContext: string | null;
  interceptionPathname: string;
  isProgressiveActionRender: boolean;
  isRscRequest: boolean;
  middlewareContext: AppRscMiddlewareContext;
  mountedSlotsHeader: string | null;
  params: AppPageParams;
  pprFallbackCacheShells?: readonly {
    fallbackParamNames: readonly string[];
    params: AppPageParams;
    pathname: string;
  }[] | null;
  pprFallbackShell?: {
    fallbackParamNames: readonly string[];
    routePattern: string;
  };
  renderedConcreteUrlPaths?: ReadonlySet<string>;
  skipStaticParamsValidation?: boolean;
  staticParamsValidationParams?: AppPageParams;
  rootParams?: RootParams;
  request: Request;
  renderedPathAndSearch?: string | null;
  route: TRoute;
  scriptNonce?: string;
  searchParams: URLSearchParams;
  renderMode: AppRscRenderMode;
};
type DispatchMatchedRouteHandlerOptions<TRoute> = {
  cleanPathname: string;
  middlewareContext: AppRscMiddlewareContext;
  /**
   * `null` for non-dynamic routes. Mirrors Next.js' route handler context
   * shape: user code that does `params ? await params : null` resolves to
   * `null` for routes without dynamic segments. Dynamic routes receive the
   * matched params object.
   */
  params: AppPageParams | null;
  request: Request;
  route: TRoute;
  searchParams: URLSearchParams;
};
type HandleProgressiveActionRequestOptions<TRoute> = {
  actionId: string | null;
  cleanPathname: string;
  contentType: string;
  middlewareContext: AppRscMiddlewareContext;
  request: Request;
  routeMatch: AppRscRouteMatch<TRoute> | null;
};
/**
 * Side-effect headers captured during a progressive (no-JS) server action's
 * non-redirect execution. Forwarded onto the page render response so that
 * `cookies().set(...)` and revalidation kinds reach the browser. See
 * `app-server-action-execution.ts` and issue #1483 for the full rationale.
 */
type ProgressiveActionSideEffects = {
  pendingCookies: string[];
  draftCookie: string | null | undefined; /** Numeric revalidation kind: `0` (none), `1` (static+dynamic), etc. */
  revalidationKind: number;
};
type ProgressiveActionFormStateResult = ({
  formState: ReactFormState | null;
  kind: "form-state";
} & ProgressiveActionSideEffects) | ({
  actionError: unknown;
  actionFailed: true;
  formState: null;
  kind: "form-state";
} & ProgressiveActionSideEffects);
type HandleServerActionRequestOptions<TRoute> = {
  actionId: string | null;
  cleanPathname: string;
  contentType: string;
  interceptionContext: string | null;
  isRscRequest: boolean;
  middlewareContext: AppRscMiddlewareContext;
  mountedSlotsHeader: string | null;
  request: Request;
  routeMatch: AppRscRouteMatch<TRoute> | null;
  routePathname: string;
  searchParams: URLSearchParams;
};
type RenderNotFoundOptions<TRoute> = {
  isRscRequest: boolean;
  matchedParams?: AppPageParams;
  middlewareContext: AppRscMiddlewareContext;
  request: Request;
  route: TRoute | null;
  scriptNonce?: string;
};
type RenderPagesFallbackOptions = {
  allowRscDocumentFallback?: boolean;
  appRouteMatch?: {
    route: {
      isDynamic: boolean;
      pattern: string;
    };
  } | null;
  isDataRequest?: boolean;
  isRscRequest: boolean;
  matchKind?: "dynamic" | "static";
  middlewareContext: AppRscMiddlewareContext;
  pathname?: string;
  pagesDataRequest?: Request | null;
  request: Request;
  url: URL;
};
type NavigationContextValue = {
  params: AppPageParams;
  pathname: string;
  searchParams: URLSearchParams;
};
type CreateAppRscHandlerOptions<TRoute extends AppRscHandlerRoute> = {
  basePath: string;
  buildId: string | null;
  clearRequestContext: () => void;
  configHeaders: NextHeader[];
  configRedirects: NextRedirect[];
  configRewrites: {
    afterFiles: NextRewrite[];
    beforeFiles: NextRewrite[];
    fallback: NextRewrite[];
  };
  draftModeSecret: string;
  dispatchMatchedPage: (options: DispatchMatchedPageOptions<TRoute>) => Promise<Response>;
  dispatchMatchedRouteHandler: (options: DispatchMatchedRouteHandlerOptions<TRoute>) => Promise<Response>;
  /**
   * Hydrate a matched route's lazily-loaded page/route-handler modules before
   * any synchronous read of `route.page` / `route.routeHandler`. Idempotent and
   * dedup'd. Provided by the generated RSC entry; absent in older entries.
   */
  ensureRouteLoaded?: (route: TRoute) => unknown;
  ensureInstrumentation?: () => Promise<void>;
  /**
   * Register cache adapters configured via the vinext() `cache` option. Wired
   * from the generated RSC entry (which can import `virtual:vinext-cache-adapters`)
   * so config-driven cache handlers apply to App Router on EVERY runtime — the
   * Node server and dev included, not just the Cloudflare worker entry.
   */
  registerCacheAdapters: (env?: Record<string, unknown>) => void;
  handleProgressiveActionRequest?: (options: HandleProgressiveActionRequestOptions<TRoute>) => Promise<Response | ProgressiveActionFormStateResult | null>;
  handleMetadataRouteRequest?: (cleanPathname: string) => Promise<Response | null>;
  createPprFallbackShells?: (route: Pick<AppRscHandlerRoute, "params" | "pattern" | "rootParamNames">, params: AppPageParams) => AppPagePprFallbackCacheShell[];
  handleServerActionRequest?: (options: HandleServerActionRequestOptions<TRoute>) => Promise<Response | null>;
  i18nConfig: NextI18nConfig | null;
  imageConfig?: ImageConfig;
  isDev: boolean;
  loadPrerenderPagesRoutes?: () => Promise<unknown>;
  matchRoute: (pathname: string) => AppRscRouteMatch<TRoute> | null;
  matchRequestRoute?: (pathname: string) => AppRscRouteMatch<TRoute> | null;
  runMiddleware?: (options: RunAppMiddlewareOptions) => Promise<ApplyAppMiddlewareResult>;
  publicFiles: ReadonlySet<string>;
  prefetchInlining?: PrefetchInliningConfig;
  renderNotFound: (options: RenderNotFoundOptions<TRoute>) => Promise<Response | null>;
  renderPagesFallback?: (options: RenderPagesFallbackOptions) => Promise<Response | null>;
  rootParamNamesByPattern?: RootParamNamesMap;
  setNavigationContext: (context: NavigationContextValue) => void;
  staticParamsMap: StaticParamsMap;
  trailingSlash: boolean;
  validateDevRequestOrigin?: (request: Request) => Response | null;
};
declare function createAppRscHandler<TRoute extends AppRscHandlerRoute>(options: CreateAppRscHandlerOptions<TRoute>): (request: Request, ctx: unknown) => Promise<Response>;
//#endregion
export { createAppRscHandler };