import { normalizePathnameForRouteMatch } from "../routing/utils.js";
import { normalizePath } from "./normalize-path.js";
//#region src/server/pregenerated-concrete-paths.ts
function normalizePregeneratedPathname(pathname) {
	return normalizePath(normalizePathnameForRouteMatch(pathname));
}
/**
* Stores concrete URL paths pre-rendered at build time per route pattern.
* Used by the PPR fallback-shell guard to avoid serving fallback shells for
* known routes whose exact cache entry is temporarily absent.
*
* Populated by `seed-cache.ts` (Node) or from `globalThis.__VINEXT_PREGENERATED_CONCRETE_PATHS`
* injected by `deploy.ts` after prerender (Workers).
*/
const concreteUrlPathsByRoute = /* @__PURE__ */ new Map();
function clearPregeneratedConcretePaths() {
	concreteUrlPathsByRoute.clear();
}
function addPregeneratedConcretePath(routePattern, pathname) {
	let paths = concreteUrlPathsByRoute.get(routePattern);
	if (!paths) {
		paths = /* @__PURE__ */ new Set();
		concreteUrlPathsByRoute.set(routePattern, paths);
	}
	paths.add(normalizePregeneratedPathname(pathname));
}
function getRenderedConcreteUrlPathsForRoute(routePattern) {
	return concreteUrlPathsByRoute.get(routePattern);
}
/**
* Populate the registry from `globalThis.__VINEXT_PREGENERATED_CONCRETE_PATHS`.
* No-op when the global is not set (Node path — seed-cache handles it later).
* Pathnames are normalised so they match the runtime `cleanPathname`.
*/
function initPregeneratedPathsFromGlobals() {
	const raw = globalThis.__VINEXT_PREGENERATED_CONCRETE_PATHS;
	const data = parsePregeneratedConcretePaths(raw);
	if (!data) return;
	clearPregeneratedConcretePaths();
	for (const [routePattern, pathnames] of data) for (const pathname of pathnames) addPregeneratedConcretePath(routePattern, pathname);
}
function parsePregeneratedConcretePaths(value) {
	if (!Array.isArray(value)) return void 0;
	const result = [];
	for (const entry of value) {
		if (!Array.isArray(entry)) return void 0;
		if (entry.length !== 2) return void 0;
		const [pattern, paths] = entry;
		if (typeof pattern !== "string") return void 0;
		if (!Array.isArray(paths)) return void 0;
		const strings = [];
		for (const p of paths) {
			if (typeof p !== "string") return void 0;
			strings.push(p);
		}
		result.push([pattern, strings]);
	}
	return result;
}
//#endregion
export { addPregeneratedConcretePath, clearPregeneratedConcretePaths, getRenderedConcreteUrlPathsForRoute, initPregeneratedPathsFromGlobals, normalizePregeneratedPathname };
