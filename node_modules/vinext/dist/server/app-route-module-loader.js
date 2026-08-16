//#region src/server/app-route-module-loader.ts
function pushFieldLoad(loads, target, field, loader) {
	if (!loader || target[field] != null) return;
	loads.push(loader().then((module) => {
		target[field] = module;
	}));
}
function pushArrayLoads(loads, target, loaders) {
	if (!target || !loaders) return;
	const slots = target;
	for (const [index, loader] of loaders.entries()) {
		if (index >= slots.length || !loader || slots[index] != null) continue;
		loads.push(loader().then((module) => {
			slots[index] = module;
		}));
	}
}
function loadAppInterceptLayouts(intercept) {
	const loadState = intercept.__loadState;
	if (loadState?.interceptLayoutsLoading) return loadState.interceptLayoutsLoading;
	const loads = [];
	pushArrayLoads(loads, intercept.interceptLayouts, intercept.__loadInterceptLayouts);
	if (loads.length === 0) return Promise.resolve(intercept.interceptLayouts ?? []);
	const loading = Promise.all(loads).then(() => {
		if (loadState) loadState.interceptLayoutsLoading = null;
		return intercept.interceptLayouts ?? [];
	}).catch((error) => {
		if (loadState) loadState.interceptLayoutsLoading = null;
		throw error;
	});
	if (loadState) loadState.interceptLayoutsLoading = loading;
	return loading;
}
/**
* Resolve a route's lazy modules and assign them onto the route's synchronous
* module fields. Returns the same route reference (synchronously when already
* loaded, otherwise after the in-flight import resolves). Safe to call on
* `null`/`undefined` routes and on eager routes that have no lazy thunks.
*/
function ensureAppRouteModulesLoaded(route) {
	if (!route || route.__loaded) return route;
	if (route.__loading) return route.__loading;
	const loadPage = route.__loadPage;
	const loadRouteHandler = route.__loadRouteHandler;
	const loads = [];
	pushFieldLoad(loads, route, "page", loadPage);
	pushFieldLoad(loads, route, "routeHandler", loadRouteHandler);
	pushFieldLoad(loads, route, "loading", route.__loadLoading);
	pushFieldLoad(loads, route, "error", route.__loadError);
	pushFieldLoad(loads, route, "notFound", route.__loadNotFound);
	pushFieldLoad(loads, route, "forbidden", route.__loadForbidden);
	pushFieldLoad(loads, route, "unauthorized", route.__loadUnauthorized);
	pushArrayLoads(loads, route.layouts, route.__loadLayouts);
	pushArrayLoads(loads, route.templates, route.__loadTemplates);
	pushArrayLoads(loads, route.errors, route.__loadErrors);
	pushArrayLoads(loads, route.errorPaths, route.__loadErrorPaths);
	pushArrayLoads(loads, route.notFounds, route.__loadNotFounds);
	pushArrayLoads(loads, route.forbiddens, route.__loadForbiddens);
	pushArrayLoads(loads, route.unauthorizeds, route.__loadUnauthorizeds);
	for (const slot of Object.values(route.slots ?? {})) {
		pushFieldLoad(loads, slot, "page", slot.__loadPage);
		pushFieldLoad(loads, slot, "default", slot.__loadDefault);
		pushFieldLoad(loads, slot, "layout", slot.__loadLayout);
		pushArrayLoads(loads, slot.configLayouts, slot.__loadConfigLayouts);
		pushFieldLoad(loads, slot, "loading", slot.__loadLoading);
		pushFieldLoad(loads, slot, "error", slot.__loadError);
		pushFieldLoad(loads, slot, "notFound", slot.__loadNotFound);
	}
	if (loads.length === 0) {
		route.__loaded = true;
		return route;
	}
	const loading = Promise.all(loads).then(() => {
		route.__loaded = true;
		route.__loading = null;
		return route;
	}).catch((error) => {
		route.__loading = null;
		throw error;
	});
	route.__loading = loading;
	return loading;
}
//#endregion
export { ensureAppRouteModulesLoaded, loadAppInterceptLayouts };
