import fs from "node:fs";
//#region src/server/prerender-manifest.ts
function readPrerenderManifest(manifestPath) {
	if (!fs.existsSync(manifestPath)) return null;
	try {
		return JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
	} catch (error) {
		console.warn(`[vinext] Failed to read prerender manifest at ${manifestPath}:`, error);
		return null;
	}
}
function getRenderedAppRoutes(routes) {
	return routes.filter((r) => r.status === "rendered" && r.router === "app");
}
function groupRoutesByPattern(routes) {
	const byPattern = /* @__PURE__ */ new Map();
	for (const r of routes) {
		const pathname = r.path ?? r.route;
		const existing = byPattern.get(r.route);
		if (existing) existing.push(pathname);
		else byPattern.set(r.route, [pathname]);
	}
	return byPattern;
}
function isErrorDocumentRoute(pathname, route) {
	return pathname === "/404" || pathname === "/500" || pathname === "/_error" || route.route === "/404" || route.route === "/500" || route.route === "/_error";
}
/**
* Returns true when `pathname` contains bracket-delimited route params,
* indicating it is a fallback-shell placeholder (e.g. `/en/blog/[slug]`)
* rather than a concrete rendered URL.
*/
function isFallbackShellArtifactPath(pathname, route) {
	if (route?.fallback === true) return true;
	if (route?.fallback === void 0) {
		if (process.env.NODE_ENV !== "production") console.warn("[vinext] Legacy manifest detected: missing `fallback` flag for route. Using bracket heuristic for fallback-shell detection. A concrete URL containing literal brackets may be misclassified as a fallback shell.");
		return pathname.includes("[") || pathname.includes("]");
	}
	return false;
}
/**
* Build the pregenerated concrete-path payload table from a prerender manifest.
*
* Filters out fallback-shell placeholder paths and groups remaining concrete
* paths by route pattern. Returns an empty array when the manifest has no
* rendered App routes or all routes are fallback-shell artifacts.
*/
function buildPregeneratedConcretePathTable(manifest) {
	const routes = manifest?.routes;
	if (!routes?.length) return [];
	const concreteRoutes = getRenderedAppRoutes(routes).filter((r) => {
		return !isFallbackShellArtifactPath(r.path ?? r.route, r);
	});
	return Array.from(groupRoutesByPattern(concreteRoutes).entries());
}
/**
* Select concrete URL paths that were rendered by the prerender engine.
*
* This intentionally includes both App Router and Pages Router entries because
* deploy-time cache warmup should exercise the same URLs the prerender phase
* proved are statically renderable. PPR fallback-shell placeholder artifacts
* and known error documents are excluded by default so warmup does not request
* synthetic bracket paths or treat a healthy 404 response as a failed warmup.
*/
function getPrerenderedConcretePaths(manifest, options) {
	const routes = manifest.routes;
	if (!routes?.length) return [];
	const paths = [];
	const seen = /* @__PURE__ */ new Set();
	for (const route of routes) {
		if (route.status !== "rendered") continue;
		const pathname = route.path ?? route.route;
		if (!options?.includeFallbackShells && isFallbackShellArtifactPath(pathname, route)) continue;
		if (!options?.includeErrorDocuments && isErrorDocumentRoute(pathname, route)) continue;
		if (seen.has(pathname)) continue;
		seen.add(pathname);
		paths.push(pathname);
	}
	return paths;
}
//#endregion
export { buildPregeneratedConcretePathTable, getPrerenderedConcretePaths, getRenderedAppRoutes, isFallbackShellArtifactPath, readPrerenderManifest };
