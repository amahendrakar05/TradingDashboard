import { ValidFileMatcher } from "./file-matcher.js";
import { AppRoute, AppRouteGraphRoute, RouteManifest, computeAppRouteStaticSiblings, computeRootParamNames, convertSegmentsToRouteParts } from "./app-route-graph.js";

//#region src/routing/app-router.d.ts
type AppRouteGraph = {
  routes: AppRouteGraphRoute[];
  routeManifest: RouteManifest;
};
declare function invalidateAppRouteCache(): void;
/**
 * Scan the app/ directory and return the route graph.
 * TODO(#726): Layer 4 should consume this read model directly once the
 * navigation planner owns route graph facts.
 *
 * @internal
 */
declare function appRouteGraph(appDir: string, pageExtensions?: readonly string[], matcher?: ValidFileMatcher): Promise<AppRouteGraph>;
/**
 * Scan the app/ directory and return a list of routes.
 */
declare function appRouter(appDir: string, pageExtensions?: readonly string[], matcher?: ValidFileMatcher): Promise<AppRouteGraphRoute[]>;
/**
 * Match a URL against App Router routes.
 */
declare function matchAppRoute(url: string, routes: AppRoute[]): {
  route: AppRoute;
  params: Record<string, string | string[]>;
} | null;
//#endregion
export { type AppRoute, appRouteGraph, appRouter, computeAppRouteStaticSiblings, computeRootParamNames, convertSegmentsToRouteParts, invalidateAppRouteCache, matchAppRoute };