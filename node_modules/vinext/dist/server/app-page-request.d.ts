import { AppPageSpecialError } from "./app-page-execution.js";
import { AppLayoutParamAccessTracker } from "./app-layout-param-observation.js";

//#region src/server/app-page-request.d.ts
type AppPageParams = Record<string, string | string[]>;
type GenerateStaticParams = (args: {
  params: AppPageParams;
}) => unknown;
type Awaitable<T> = T | Promise<T>;
type GenerateStaticParamsModule = {
  generateStaticParams?: GenerateStaticParams | null;
};
type GenerateStaticParamsSource = {
  /**
   * Primary loader-tree sources execute top-down as one chain. Each source
   * receives the complete params object produced by the sources before it.
   */
  chained?: true;
  generateStaticParams: GenerateStaticParams;
  independentChain?: number;
  paramAliases?: Readonly<Record<string, string>>;
  paramPatternParts?: readonly string[];
  routePatternParts?: readonly string[];
  parentParamNames: readonly string[];
};
type ParallelGenerateStaticParamsBranch = {
  configLayouts?: readonly (GenerateStaticParamsModule | null | undefined)[] | null;
  configLayoutTreePositions?: readonly number[] | null;
  layout?: GenerateStaticParamsModule | null;
  page?: GenerateStaticParamsModule | null;
  paramNames?: readonly string[] | null;
  patternParts?: readonly string[] | null;
  routeSegments?: readonly string[] | null;
};
type ValidateAppPageDynamicParamsOptions = {
  clearRequestContext: () => void;
  enforceStaticParamsOnly: boolean;
  generateStaticParams?: GenerateStaticParams | GenerateStaticParamsSource | readonly (GenerateStaticParams | GenerateStaticParamsSource | null | undefined)[] | null;
  isDynamicRoute: boolean;
  params: AppPageParams;
};
type ResolveAppPageGenerateStaticParamsSourcesOptions = {
  layouts?: readonly (GenerateStaticParamsModule | null | undefined)[];
  layoutTreePositions?: readonly number[];
  page?: GenerateStaticParamsModule | null;
  parallelBranches?: readonly (ParallelGenerateStaticParamsBranch | null | undefined)[];
  routePatternParts?: readonly string[];
  routeSegments: readonly string[];
};
type BuildAppPageElementOptions<TElement> = {
  buildPageElement: () => Promise<TElement>;
  probePageSpecialError?: () => Promise<AppPageSpecialError | null>;
  renderErrorBoundaryPage: (error: unknown) => Promise<Response | null>;
  renderSpecialError: (specialError: AppPageSpecialError) => Promise<Response>;
  resolveSpecialError: (error: unknown) => AppPageSpecialError | null;
};
type BuildAppPageElementResult<TElement> = {
  element: TElement | null;
  response: Response | null;
};
type AppPageInterceptMatch<TPage = unknown> = {
  interceptLayouts?: readonly unknown[] | null;
  interceptLayoutSegments?: readonly (readonly string[])[] | null;
  interceptBranchSegments?: readonly string[] | null;
  interceptNotFoundBranchSegments?: readonly string[] | null;
  __loadInterceptLayouts?: readonly (() => Promise<unknown>)[] | null;
  matchedParams: AppPageParams;
  sourceMatchedParams?: AppPageParams;
  page: TPage;
  __pageLoader?: (() => Promise<TPage>) | null;
  notFound?: unknown;
  __loadNotFound?: (() => Promise<unknown>) | null;
  notFoundTreePosition?: number | null;
  __loadState?: {
    page: TPage;
    pageLoading: Promise<TPage> | null;
    notFound?: unknown;
    notFoundLoading?: Promise<unknown> | null;
    interceptLayoutsLoading: Promise<readonly unknown[]> | null;
  };
  slotId?: string | null;
  slotKey: string;
  sourceRouteIndex: number;
  sourcePageSegments?: readonly string[] | null;
};
type ResolveAppPageInterceptMatchOptions<TRoute, TPage, TInterceptOpts> = {
  cleanPathname: string;
  currentRoute: TRoute;
  findIntercept: (pathname: string) => AppPageInterceptMatch<TPage> | null;
  getRouteParamNames: (route: TRoute) => readonly string[];
  getSourceRoute: (sourceRouteIndex: number) => Awaitable<TRoute | undefined>;
  isRscRequest: boolean;
  toInterceptOpts: (intercept: AppPageInterceptMatch<TPage>) => TInterceptOpts;
};
type ResolveAppPageInterceptMatchResult<TRoute, TInterceptOpts> = {
  interceptOpts: TInterceptOpts;
  matchedParams: AppPageParams;
  sourceParams: AppPageParams;
  sourceRoute: TRoute;
};
type ResolveAppPageInterceptionRerenderTargetOptions<TRoute, TPage, TInterceptOpts> = {
  cleanPathname: string;
  currentParams: AppPageParams;
  currentRoute: TRoute;
  findIntercept: (pathname: string) => AppPageInterceptMatch<TPage> | null;
  getRouteParamNames: (route: TRoute) => readonly string[];
  getSourceRoute: (sourceRouteIndex: number) => Awaitable<TRoute | undefined>;
  isRscRequest: boolean;
  toInterceptOpts: (intercept: AppPageInterceptMatch<TPage>) => TInterceptOpts;
};
type ResolveAppPageInterceptionRerenderTargetResult<TRoute, TInterceptOpts> = {
  interceptOpts: TInterceptOpts | undefined;
  navigationParams: AppPageParams;
  params: AppPageParams;
  route: TRoute;
};
type ResolveAppPageActionRerenderTargetOptions<TRoute, TPage, TInterceptOpts> = ResolveAppPageInterceptionRerenderTargetOptions<TRoute, TPage, TInterceptOpts>;
type ResolveAppPageActionRerenderTargetResult<TRoute, TInterceptOpts> = ResolveAppPageInterceptionRerenderTargetResult<TRoute, TInterceptOpts>;
type ResolveAppPageInterceptOptions<TRoute, TPage, TInterceptOpts, TElement> = {
  buildPageElement: (route: TRoute, params: AppPageParams, interceptOpts: TInterceptOpts | undefined, searchParams: URLSearchParams, layoutParamAccess?: AppLayoutParamAccessTracker, buildOptions?: {
    observeMetadataSearchParamsAccess?: boolean;
    observePageSearchParamsAccess?: boolean;
  }) => Promise<TElement>;
  cleanPathname: string;
  currentRoute: TRoute;
  findIntercept: (pathname: string) => AppPageInterceptMatch<TPage> | null;
  getRouteParamNames: (route: TRoute) => readonly string[];
  getSourceRoute: (sourceRouteIndex: number) => Awaitable<TRoute | undefined>;
  isRscRequest: boolean;
  layoutParamAccess?: AppLayoutParamAccessTracker;
  resolveNavigationParams: (route: TRoute, params: AppPageParams, pathname: string, interceptOpts: TInterceptOpts) => AppPageParams;
  renderInterceptResponse: (route: TRoute, element: TElement) => Promise<Response> | Response;
  resolveSearchParams?: (route: TRoute, searchParams: URLSearchParams) => Awaitable<URLSearchParams>;
  searchParams: URLSearchParams;
  setNavigationContext: (context: {
    params: AppPageParams;
    pathname: string;
    searchParams: URLSearchParams;
  }) => void;
  toInterceptOpts: (intercept: AppPageInterceptMatch<TPage>) => TInterceptOpts;
};
type ResolveAppPageInterceptResult<TInterceptOpts> = {
  interceptOpts: TInterceptOpts | undefined;
  response: Response | null;
};
declare function resolveAppPageGenerateStaticParamsSources(options: ResolveAppPageGenerateStaticParamsSourcesOptions): GenerateStaticParamsSource[];
declare function validateAppPageDynamicParams(options: ValidateAppPageDynamicParamsOptions): Promise<Response | null>;
/**
 * Pure: decides whether the incoming request should re-render an intercepted
 * source-route tree, and if so returns the source route, the source-route's
 * param slice, the full matched param set (the URL params the client sees),
 * and an opaque `interceptOpts` bag for the caller's render pipeline.
 *
 * Returns `null` in three decision-fallthrough cases:
 *   - non-RSC requests (server rendering the direct page for a full HTML load)
 *   - no intercepting route matches the path
 *   - the match's source route IS the current route (the same branch today
 *     returns `interceptOpts` for the direct render)
 *
 * Shared by both the GET path (resolveAppPageIntercept, which layers on
 * `setNavigationContext` + element build + Response wrap) and the server-action
 * POST path (entries/app-rsc-entry.ts), which runs its own response pipeline.
 */
declare function resolveAppPageInterceptMatch<TRoute, TPage, TInterceptOpts>(options: ResolveAppPageInterceptMatchOptions<TRoute, TPage, TInterceptOpts>): Promise<ResolveAppPageInterceptMatchResult<TRoute, TInterceptOpts> | null>;
declare function resolveAppPageInterceptionRerenderTarget<TRoute, TPage, TInterceptOpts>(options: ResolveAppPageInterceptionRerenderTargetOptions<TRoute, TPage, TInterceptOpts>): Promise<ResolveAppPageInterceptionRerenderTargetResult<TRoute, TInterceptOpts>>;
declare function resolveAppPageActionRerenderTarget<TRoute, TPage, TInterceptOpts>(options: ResolveAppPageActionRerenderTargetOptions<TRoute, TPage, TInterceptOpts>): Promise<ResolveAppPageActionRerenderTargetResult<TRoute, TInterceptOpts>>;
declare function resolveAppPageIntercept<TRoute, TPage, TInterceptOpts, TElement>(options: ResolveAppPageInterceptOptions<TRoute, TPage, TInterceptOpts, TElement>): Promise<ResolveAppPageInterceptResult<TInterceptOpts>>;
declare function buildAppPageElement<TElement>(options: BuildAppPageElementOptions<TElement>): Promise<BuildAppPageElementResult<TElement>>;
//#endregion
export { ValidateAppPageDynamicParamsOptions, buildAppPageElement, resolveAppPageActionRerenderTarget, resolveAppPageGenerateStaticParamsSources, resolveAppPageIntercept, resolveAppPageInterceptMatch, resolveAppPageInterceptionRerenderTarget, validateAppPageDynamicParams };