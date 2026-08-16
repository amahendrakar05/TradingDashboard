import { apiRouter, pagesRouter } from "../routing/pages-router.js";
import { buildReportRows } from "./report.js";
import { appRouter } from "../routing/app-router.js";
//#region src/build/nitro-route-rules.ts
/**
* Scans the filesystem for route files and generates Nitro `routeRules` for ISR routes.
*
* Note: this duplicates the filesystem scanning that `printBuildReport` also performs.
* The `nitro.setup` hook runs during Nitro initialization (before the build), while
* `printBuildReport` runs after the build, so sharing results is non-trivial. This is
* a future optimization target.
*
* Unlike `printBuildReport`, this path does not receive `prerenderResult`, so routes
* classified as `unknown` by static analysis (which `printBuildReport` might upgrade
* to `static` via speculative prerender) are skipped here.
*/
async function collectNitroRouteRules(options) {
	const { appDir, pageExtensions, pagesDir } = options;
	let appRoutes = [];
	let pageRoutes = [];
	let apiRoutes = [];
	if (appDir) appRoutes = await appRouter(appDir, pageExtensions);
	if (pagesDir) {
		const [pages, apis] = await Promise.all([pagesRouter(pagesDir, pageExtensions), apiRouter(pagesDir, pageExtensions)]);
		pageRoutes = pages;
		apiRoutes = apis;
	}
	return generateNitroRouteRules(buildReportRows({
		appRoutes,
		pageRoutes,
		apiRoutes
	}));
}
function generateNitroRouteRules(rows) {
	const rules = {};
	for (const row of rows) if (row.type === "isr" && typeof row.revalidate === "number" && Number.isFinite(row.revalidate) && row.revalidate > 0) rules[convertToNitroPattern(row.pattern)] = { swr: row.revalidate };
	return rules;
}
/**
* Converts vinext's internal `:param` route syntax to Nitro's rou3
* pattern format. Nitro uses `rou3` for routeRules matching, which
* supports `*` (single-segment) and `**` (multi-segment) wildcards.
*
*   /blog/:slug   -> /blog/*   (single segment)
*   /docs/:slug+  -> /docs/**  (one or more segments — catch-all)
*   /docs/:slug*  -> /docs/**  (zero or more segments — optional catch-all)
*   /about        -> /about    (unchanged)
*   /:a/:b produces `/*`/`/*` (consecutive single-segment params)
*/
function convertToNitroPattern(pattern) {
	return pattern.split("/").map((segment) => {
		if (segment.startsWith(":")) return segment.endsWith("+") || segment.endsWith("*") ? "**" : "*";
		return segment;
	}).join("/");
}
function mergeNitroRouteRules(existingRouteRules, generatedRouteRules) {
	const routeRules = { ...existingRouteRules };
	const skippedRoutes = [];
	for (const [route, generatedRule] of Object.entries(generatedRouteRules)) {
		const existingRule = routeRules[route];
		if (existingRule && hasUserDefinedCacheRule(existingRule)) {
			skippedRoutes.push(route);
			continue;
		}
		routeRules[route] = {
			...existingRule,
			...generatedRule
		};
	}
	return {
		routeRules,
		skippedRoutes
	};
}
function hasUserDefinedCacheRule(rule) {
	return rule.swr !== void 0 || rule.cache !== void 0 || rule.static !== void 0 || rule.isr !== void 0 || rule.prerender !== void 0;
}
//#endregion
export { collectNitroRouteRules, convertToNitroPattern, generateNitroRouteRules, mergeNitroRouteRules };
