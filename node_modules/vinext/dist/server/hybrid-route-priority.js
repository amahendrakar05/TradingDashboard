import { compareHybridRoutePatterns } from "../routing/utils.js";
import { validateRoutePatterns } from "../routing/route-validation.js";
//#region src/server/hybrid-route-priority.ts
function validateHybridRouteConflicts(pagesRoutes, appRoutes) {
	const pagesByPattern = new Map(pagesRoutes.map((route) => [route.pattern, route]));
	const conflicts = appRoutes.flatMap((appRoute) => {
		const pagesRoute = pagesByPattern.get(appRoute.pattern);
		return pagesRoute === void 0 ? [] : [[pagesRoute, appRoute]];
	});
	if (conflicts.length > 0) {
		const message = `Conflicting app and page file${conflicts.length === 1 ? " was" : "s were"} found, please remove the conflicting files to continue:`;
		throw new Error(`${message}\n${conflicts.map(([pagesRoute, appRoute]) => `  "${pagesRoute.sourcePath ?? pagesRoute.pattern}" - "${appRoute.sourcePath ?? appRoute.pattern}"`).join("\n")}`);
	}
	validateRoutePatterns([...pagesRoutes.map((route) => route.pattern), ...appRoutes.map((route) => route.pattern)]);
}
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
function pagesRouteHasPriorityOverAppRoute(pagesRoute, appRoute) {
	if (appRoute === null) return true;
	return compareHybridRoutePatterns(pagesRoute.pattern, pagesRoute.isDynamic, appRoute.pattern, appRoute.isDynamic) === "pages";
}
//#endregion
export { pagesRouteHasPriorityOverAppRoute, validateHybridRouteConflicts };
