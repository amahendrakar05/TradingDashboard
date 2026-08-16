//#region src/server/app-route-module-loader.d.ts
/**
 * Lazy route-module hydration for the App Router RSC entry.
 *
 * The generated route table (see `entries/app-rsc-manifest.ts`) emits page and
 * route-handler modules as lazy `() => import()` thunks instead of eager
 * `import * as mod_N` namespaces. This keeps those modules out of the RSC
 * entry's top-level evaluation, so an app with many routes — or routes with
 * expensive module-level initialization — does not pay to evaluate every route
 * module at Worker startup. Only the module(s) for the matched route are
 * evaluated, on demand.
 *
 * `ensureAppRouteModulesLoaded` resolves a route's lazy thunks and populates
 * the synchronous module fields that the rest of the request pipeline reads
 * directly (`page`, `routeHandler`, layouts, templates, boundaries, and
 * parallel-slot modules). It is:
 *
 *  - idempotent: once a route is loaded it returns immediately;
 *  - dedup'd: concurrent calls for the same route share one in-flight promise,
 *    so a burst of requests to the same route triggers a single import.
 *
 * Callers must `await` it before any synchronous read of route modules
 * (segment config, fetch-cache mode, runtime resolution, dispatch branch,
 * element building, etc.).
 */
type LazyModuleThunk = () => Promise<unknown>;
type LazyModuleLoaderArray = readonly (LazyModuleThunk | null | undefined)[];
type LazyLoadableIntercept = {
  interceptLayouts?: readonly unknown[] | null;
  __loadInterceptLayouts?: LazyModuleLoaderArray | null;
  __loadState?: {
    interceptLayoutsLoading: Promise<readonly unknown[]> | null;
  };
};
type LazyLoadableSlot = {
  page?: unknown;
  default?: unknown;
  layout?: unknown;
  configLayouts?: readonly unknown[];
  loading?: unknown;
  error?: unknown;
  notFound?: unknown;
  __loadPage?: LazyModuleThunk | null;
  __loadDefault?: LazyModuleThunk | null;
  __loadLayout?: LazyModuleThunk | null;
  __loadConfigLayouts?: LazyModuleLoaderArray | null;
  __loadLoading?: LazyModuleThunk | null;
  __loadError?: LazyModuleThunk | null;
  __loadNotFound?: LazyModuleThunk | null; /** Hydrated only after an intercept matches, not with the slot's base modules. */
  intercepts?: LazyLoadableIntercept[];
};
type LazyLoadableRoute = {
  page?: unknown;
  routeHandler?: unknown;
  layouts?: unknown[];
  templates?: unknown[];
  errors?: unknown[];
  errorPaths?: unknown[];
  notFounds?: unknown[];
  forbiddens?: unknown[];
  unauthorizeds?: unknown[];
  loading?: unknown;
  error?: unknown;
  notFound?: unknown;
  forbidden?: unknown;
  unauthorized?: unknown;
  slots?: Record<string, LazyLoadableSlot>;
  siblingIntercepts?: LazyLoadableIntercept[]; /** Lazy loader for the page module; `null`/absent when the page is eager. */
  __loadPage?: LazyModuleThunk | null; /** Lazy loader for the route-handler module; `null`/absent when none. */
  __loadRouteHandler?: LazyModuleThunk | null;
  __loadLayouts?: LazyModuleLoaderArray | null;
  __loadTemplates?: LazyModuleLoaderArray | null;
  __loadErrors?: LazyModuleLoaderArray | null;
  __loadErrorPaths?: LazyModuleLoaderArray | null;
  __loadNotFounds?: LazyModuleLoaderArray | null;
  __loadForbiddens?: LazyModuleLoaderArray | null;
  __loadUnauthorizeds?: LazyModuleLoaderArray | null;
  __loadLoading?: LazyModuleThunk | null;
  __loadError?: LazyModuleThunk | null;
  __loadNotFound?: LazyModuleThunk | null;
  __loadForbidden?: LazyModuleThunk | null;
  __loadUnauthorized?: LazyModuleThunk | null; /** Set once the route's lazy module fields have been resolved. */
  __loaded?: boolean; /** In-flight hydration promise, used to dedup concurrent loads. */
  __loading?: Promise<unknown> | null;
};
declare function loadAppInterceptLayouts(intercept: LazyLoadableIntercept): Promise<readonly unknown[]>;
/**
 * Resolve a route's lazy modules and assign them onto the route's synchronous
 * module fields. Returns the same route reference (synchronously when already
 * loaded, otherwise after the in-flight import resolves). Safe to call on
 * `null`/`undefined` routes and on eager routes that have no lazy thunks.
 */
declare function ensureAppRouteModulesLoaded<TRoute extends LazyLoadableRoute>(route: TRoute | null | undefined): TRoute | Promise<TRoute>;
//#endregion
export { LazyLoadableRoute, ensureAppRouteModulesLoaded, loadAppInterceptLayouts };