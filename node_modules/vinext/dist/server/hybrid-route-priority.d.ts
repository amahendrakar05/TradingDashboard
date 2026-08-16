//#region src/server/hybrid-route-priority.d.ts
type HybridRoutePriorityRoute = {
  isDynamic: boolean;
  pattern: string;
  sourcePath?: string | null;
};
declare function validateHybridRouteConflicts(pagesRoutes: readonly HybridRoutePriorityRoute[], appRoutes: readonly HybridRoutePriorityRoute[]): void;
/**
 * Return whether a matched Pages Router route should own the request instead
 * of a matched App Router route.
 *
 * Next.js registers Pages providers before App providers, then sorts all
 * dynamic route pathnames together in DefaultRouteMatcherManager. Vinext keeps
 * separate route tries for each router, so the hybrid boundary needs to apply
 * that same cross-router ordering after both routers have produced their best
 * local match. The decision itself lives in
 * `routing/utils.ts#compareHybridRoutePatterns` so the server and client
 * always reach the same answer.
 */
declare function pagesRouteHasPriorityOverAppRoute(pagesRoute: HybridRoutePriorityRoute, appRoute: HybridRoutePriorityRoute | null): boolean;
//#endregion
export { HybridRoutePriorityRoute, pagesRouteHasPriorityOverAppRoute, validateHybridRouteConflicts };