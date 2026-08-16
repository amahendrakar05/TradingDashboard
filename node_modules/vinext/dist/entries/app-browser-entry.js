import { resolveClientRuntimeModule, resolveRuntimeEntryModule } from "./runtime-entry-module.js";
//#region src/entries/app-browser-entry.ts
/**
* Generate the virtual browser entry module.
*
* This runs in the client (browser). It hydrates the page from the
* embedded RSC payload and handles client-side navigation by re-fetching
* RSC streams.
*/
function generateBrowserEntry(routes = [], routeManifest = null, pagesPrefetchRoutes = [], rewrites = {
	afterFiles: [],
	beforeFiles: [],
	fallback: []
}) {
	const entryPath = resolveRuntimeEntryModule("app-browser-entry");
	const navigationRuntimePath = resolveClientRuntimeModule("navigation-runtime");
	const prefetchRoutes = routes.map((route) => isLinkPrefetchRoute(route) ? toLinkPrefetchRoute(route) : toDocumentOnlyAppRoute(route));
	return `import { registerNavigationRuntimeBootstrap } from ${JSON.stringify(navigationRuntimePath)};

window.__VINEXT_LINK_PREFETCH_ROUTES__ = ${JSON.stringify(prefetchRoutes)};
// Pages route manifest for hybrid ownership decisions. In a hybrid
// app+pages build the user can land on an App page, so the App browser
// entry must also expose the Pages manifest (the Pages client entry does
// the same — whichever entry runs first emits both globals).
window.__VINEXT_PAGES_LINK_PREFETCH_ROUTES__ = ${JSON.stringify(pagesPrefetchRoutes)};
window.__VINEXT_CLIENT_REWRITES__ = ${JSON.stringify(rewrites)};
registerNavigationRuntimeBootstrap({
    routeManifest: ${buildRouteManifestExpression(routeManifest)}
});
import ${JSON.stringify(entryPath)};`;
}
/**
* Filter for routes that should appear in the `__VINEXT_LINK_PREFETCH_ROUTES__`
* manifest. Exported so the Pages Router client entry can reuse it when
* emitting the same manifest for hybrid builds — see issue #1526 and
* `pages-client-entry.ts`.
*/
function isLinkPrefetchRoute(route) {
	if (route.pagePath !== null) return true;
	return route.routePath === null && route.layouts.length > 0;
}
function toDocumentOnlyAppRoute(route) {
	return {
		canPrefetchLoadingShell: false,
		documentOnly: true,
		patternParts: [...route.patternParts],
		isDynamic: route.isDynamic
	};
}
function requiresDynamicNavigationRequest(route) {
	return route.isDynamic && route.parallelSlots.length > 0;
}
/** Project an `AppRoute` down to the public `VinextLinkPrefetchRoute` shape. */
function toLinkPrefetchRoute(route) {
	return {
		canPrefetchLoadingShell: route.loadingPath !== null,
		patternParts: [...route.patternParts],
		isDynamic: route.isDynamic,
		...requiresDynamicNavigationRequest(route) ? { requiresDynamicNavigationRequest: true } : {}
	};
}
function buildRouteManifestExpression(routeManifest) {
	if (routeManifest === null) return "null";
	const graph = routeManifest.segmentGraph;
	return `{
  graphVersion: ${JSON.stringify(routeManifest.graphVersion)},
  segmentGraph: {
    routes: ${buildMapExpression(graph.routes)},
    pages: ${buildMapExpression(graph.pages)},
    routeHandlers: ${buildMapExpression(graph.routeHandlers)},
    layouts: ${buildMapExpression(graph.layouts)},
    templates: ${buildMapExpression(graph.templates)},
    slots: ${buildMapExpression(graph.slots)},
    defaults: ${buildMapExpression(graph.defaults)},
    slotBindings: ${buildMapExpression(graph.slotBindings)},
    interceptions: ${buildMapExpression(graph.interceptions)},
    interceptionsBySlotId: ${buildMapExpression(graph.interceptionsBySlotId)},
    boundaries: ${buildMapExpression(graph.boundaries)},
    rootBoundaries: ${buildMapExpression(graph.rootBoundaries)}
  }
}`;
}
function buildMapExpression(map) {
	return `new Map(${JSON.stringify(Array.from(map.entries()))})`;
}
//#endregion
export { generateBrowserEntry, isLinkPrefetchRoute, toDocumentOnlyAppRoute, toLinkPrefetchRoute };
