import { RoutePatternParams } from "../routing/route-pattern.js";

//#region src/server/app-rsc-route-matching.d.ts
/**
 * Sentinel slot key used for sibling-style interception entries.
 * When a matched intercept carries this key, the render layer replaces the
 * route's main page element instead of a parallel slot.
 */
declare const SIBLING_PAGE_INTERCEPT_SLOT_KEY = "__vinext_page_intercept";
type AppRscRouteParams = RoutePatternParams;
type AppRscInterceptForMatching = {
  targetPattern: string;
  /**
   * URL pattern of the *intercepting route* (the path that owns the slot,
   * with route groups and `@slot` segments stripped). Mirrors Next.js'
   * `interceptingRoute` from `extractInterceptionRouteInformation`.
   *
   * Next.js implements interception as a rewrite that fires only when the
   * `Next-URL` header matches `^<sourceMatchPattern>(?:/.*)?$`. vinext's
   * matcher enforces the same constraint at `findIntercept`: an intercept
   * whose `targetPattern` matches the request URL is only valid when the
   * provided source pathname (X-Vinext-Interception-Context / Next-URL)
   * matches this pattern, with descendants allowed.
   *
   * Optional for backwards compat: when absent or empty, the matcher falls
   * back to the legacy behavior of matching by target alone (still gated on
   * a non-null source pathname).
   *
   * @see https://github.com/vercel/next.js/blob/canary/packages/next/src/lib/generate-interception-routes-rewrites.ts
   */
  sourceMatchPattern?: string;
  sourcePageSegments?: readonly string[];
  interceptLayouts: readonly unknown[];
  interceptLayoutSegments?: readonly (readonly string[])[];
  interceptBranchSegments?: readonly string[];
  interceptNotFoundBranchSegments?: readonly string[];
  __loadInterceptLayouts?: readonly (() => Promise<unknown>)[] | null;
  page: unknown;
  __pageLoader?: (() => Promise<unknown>) | null;
  notFound?: unknown;
  __loadNotFound?: (() => Promise<unknown>) | null;
  notFoundTreePosition?: number | null;
  params: readonly string[];
};
type AppRscSlotForMatching = {
  id?: string | null;
  intercepts?: readonly AppRscInterceptForMatching[];
};
type AppRscSiblingInterceptForMatching = {
  targetPattern: string;
  sourceMatchPattern: string | null;
  sourcePageSegments?: readonly string[];
  slotId: string | null;
  interceptLayouts: readonly unknown[];
  interceptLayoutSegments?: readonly (readonly string[])[];
  interceptBranchSegments?: readonly string[];
  interceptNotFoundBranchSegments?: readonly string[];
  __loadInterceptLayouts?: readonly (() => Promise<unknown>)[] | null;
  page: unknown;
  __pageLoader?: (() => Promise<unknown>) | null;
  notFound?: unknown;
  __loadNotFound?: (() => Promise<unknown>) | null;
  notFoundTreePosition?: number | null;
  params: readonly string[];
};
type AppRscRouteForMatching = {
  __loadRouteHandler?: unknown;
  pattern: string;
  patternParts: string[];
  routeHandler?: unknown;
  slots?: Record<string, AppRscSlotForMatching>;
  siblingIntercepts?: AppRscSiblingInterceptForMatching[];
};
type AppRscInterceptMatch = AppRscInterceptLookupEntry & {
  matchedParams: AppRscRouteParams;
  sourceMatchedParams: AppRscRouteParams;
};
type AppRscInterceptLoadState = {
  page: unknown;
  pageLoading: Promise<unknown> | null;
  notFound: unknown;
  notFoundLoading: Promise<unknown> | null;
  interceptLayoutsLoading: Promise<readonly unknown[]> | null;
};
type AppRscInterceptLookupEntry = {
  sourceRouteIndex: number;
  slotKey: string;
  targetPattern: string;
  targetPatternParts: string[];
  sourceMatchPattern: string | null;
  sourceMatchPatternParts: string[] | null;
  sourcePageSegments: readonly string[] | null;
  interceptLayouts: readonly unknown[];
  interceptLayoutSegments?: readonly (readonly string[])[];
  interceptBranchSegments?: readonly string[];
  interceptNotFoundBranchSegments?: readonly string[];
  __loadInterceptLayouts?: readonly (() => Promise<unknown>)[] | null;
  page: unknown;
  __pageLoader?: (() => Promise<unknown>) | null;
  notFound: unknown;
  __loadNotFound?: (() => Promise<unknown>) | null;
  notFoundTreePosition?: number | null;
  __loadState: AppRscInterceptLoadState;
  params: readonly string[];
  slotId: string | null;
};
declare function createAppRscRouteMatcher<Route extends AppRscRouteForMatching>(routes: Route[]): {
  matchRoute(url: string): {
    route: Route;
    params: AppRscRouteParams;
  } | null;
  matchRequestRoute(url: string): {
    route: Route;
    params: AppRscRouteParams;
  } | null;
  findIntercept(pathname: string, sourcePathname?: string | null): AppRscInterceptMatch | null;
};
declare function matchAppRscRoutePattern(urlParts: string[], patternParts: string[]): AppRscRouteParams | null;
//#endregion
export { SIBLING_PAGE_INTERCEPT_SLOT_KEY, createAppRscRouteMatcher, matchAppRscRoutePattern };