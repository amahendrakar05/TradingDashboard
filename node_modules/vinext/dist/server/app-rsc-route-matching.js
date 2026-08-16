import { decodeMatchedParams, splitPathSegments, splitPathnameForRouteMatch } from "../routing/utils.js";
import { buildRouteTrie, trieMatchRaw } from "../routing/route-trie.js";
import { matchRoutePattern, matchRoutePatternPrefix, matchRoutePatternRaw } from "../routing/route-pattern.js";
//#region src/server/app-rsc-route-matching.ts
/**
* Sentinel slot key used for sibling-style interception entries.
* When a matched intercept carries this key, the render layer replaces the
* route's main page element instead of a parallel slot.
*/
const SIBLING_PAGE_INTERCEPT_SLOT_KEY = "__vinext_page_intercept";
function createRouteParams() {
	return Object.create(null);
}
function appRscPathnameParts(pathname, isNormalized = false) {
	const pathOnly = pathname.split("?")[0];
	const normalizedPathname = pathOnly === "/" ? "/" : pathOnly.replace(/\/$/, "");
	return isNormalized ? splitPathSegments(normalizedPathname) : splitPathnameForRouteMatch(normalizedPathname);
}
function appRscInterceptionSourcePathnameParts(pathname) {
	const pathOnly = pathname.split("?")[0];
	return splitPathSegments(pathOnly === "/" ? "/" : pathOnly.replace(/\/$/, "")).map((segment) => {
		try {
			return decodeURIComponent(segment);
		} catch {
			return segment;
		}
	});
}
function canonicalizeAppPageParam(value) {
	try {
		return encodeURIComponent(decodeURIComponent(value));
	} catch {
		return value;
	}
}
function canonicalizeAppPageParams(params) {
	for (const key of Object.keys(params)) {
		const value = params[key];
		params[key] = Array.isArray(value) ? value.map(canonicalizeAppPageParam) : canonicalizeAppPageParam(value);
	}
}
function isAppRouteHandlerRoute(route) {
	return route.routeHandler != null || typeof route.__loadRouteHandler === "function";
}
function normalizeMatchedParamsForRoute(result) {
	if (isAppRouteHandlerRoute(result.route)) decodeMatchedParams(result.params);
	else canonicalizeAppPageParams(result.params);
}
function extractRawParamsForMatchedRoute(patternParts, pathnameParts) {
	const params = createRouteParams();
	let pathnameIndex = 0;
	for (const part of patternParts) {
		if (!part.startsWith(":")) {
			pathnameIndex += 1;
			continue;
		}
		const isCatchAll = part.endsWith("+") || part.endsWith("*");
		const paramName = part.slice(1, isCatchAll ? -1 : void 0);
		if (isCatchAll) {
			const remaining = pathnameParts.slice(pathnameIndex);
			if (remaining.length > 0) params[paramName] = [...remaining];
			break;
		}
		const value = pathnameParts[pathnameIndex];
		if (value !== void 0) params[paramName] = value;
		pathnameIndex += 1;
	}
	return params;
}
function createAppRscRouteMatcher(routes) {
	const routeTrie = buildRouteTrie(routes);
	const interceptLookup = createInterceptLookup(routes);
	const routeIndexes = new Map(routes.map((route, index) => [route, index]));
	return {
		matchRoute(url) {
			const rawParts = appRscPathnameParts(url, true);
			const result = trieMatchRaw(routeTrie, appRscPathnameParts(url, false));
			if (!result) return null;
			result.params = extractRawParamsForMatchedRoute(result.route.patternParts, rawParts);
			normalizeMatchedParamsForRoute(result);
			return result;
		},
		matchRequestRoute(url) {
			const result = trieMatchRaw(routeTrie, appRscPathnameParts(url, true));
			if (!result) return null;
			normalizeMatchedParamsForRoute(result);
			return result;
		},
		findIntercept(pathname, sourcePathname = null) {
			if (sourcePathname === null) return null;
			const urlParts = appRscPathnameParts(pathname, true);
			const sourceParts = appRscInterceptionSourcePathnameParts(sourcePathname);
			const matchedSourceRoute = trieMatchRaw(routeTrie, sourceParts);
			for (const entry of interceptLookup) {
				if (!matchInterceptSource(sourceParts, entry)) continue;
				const params = matchRoutePatternRaw(urlParts, entry.targetPatternParts);
				if (params === null) continue;
				canonicalizeAppPageParams(params);
				const concreteSourceRouteIndex = matchedSourceRoute && entry.sourceMatchPatternParts !== null ? routeIndexes.get(matchedSourceRoute.route) ?? entry.sourceRouteIndex : entry.sourceRouteIndex;
				const sourceRoute = routes[concreteSourceRouteIndex];
				const matchedSourceParams = matchedSourceRoute && entry.sourceMatchPatternParts !== null ? matchedSourceRoute.params : sourceRoute ? matchRoutePatternRaw(sourceParts, sourceRoute.patternParts) : null;
				if (matchedSourceParams === null && entry.sourceMatchPatternParts === null) continue;
				const sourceParams = matchedSourceParams && entry.sourceMatchPatternParts !== null ? pickPatternParams(matchedSourceParams, entry.sourceMatchPatternParts) : matchedSourceParams ?? createRouteParams();
				return {
					...entry,
					page: entry.__loadState.page,
					sourceRouteIndex: concreteSourceRouteIndex,
					matchedParams: mergeMatchedParams(sourceParams, params),
					sourceMatchedParams: matchedSourceParams ?? createRouteParams()
				};
			}
			return null;
		}
	};
}
/**
* Check whether the request's source pathname (Next-URL / interception
* context) satisfies the intercept entry's intercepting-route pattern, with
* descendants allowed. Mirrors the header regex shape Next.js emits for the
* generated interception rewrite: `^<pattern>(?:/.*)?$`.
*
* When the entry has no declared `sourceMatchPatternParts`, fall back to the
* legacy behavior of accepting any source (we still require the source to be
* non-null at the caller — see `findIntercept`).
*/
function matchInterceptSource(sourceParts, entry) {
	const patternParts = entry.sourceMatchPatternParts;
	if (!patternParts) return true;
	if (patternParts.length === 0) return true;
	return matchRoutePatternPrefix(sourceParts, patternParts);
}
function interceptSegmentPrecedence(segment) {
	if (!segment.startsWith(":")) return 0;
	if (segment.endsWith("*")) return 3;
	if (segment.endsWith("+")) return 2;
	return 1;
}
function compareInterceptTargetPatterns(a, b) {
	const sharedLength = Math.min(a.targetPatternParts.length, b.targetPatternParts.length);
	for (let index = 0; index < sharedLength; index++) {
		const aSegment = a.targetPatternParts[index];
		const bSegment = b.targetPatternParts[index];
		const precedence = interceptSegmentPrecedence(aSegment) - interceptSegmentPrecedence(bSegment);
		if (precedence !== 0) return precedence;
		if (aSegment !== bSegment) return aSegment.localeCompare(bSegment);
	}
	const lengthDifference = a.targetPatternParts.length - b.targetPatternParts.length;
	return lengthDifference !== 0 ? lengthDifference : a.targetPattern.localeCompare(b.targetPattern);
}
function createInterceptLookup(routes) {
	const patternToIndex = new Map(routes.map((r, i) => [r.pattern, i]));
	const interceptLookup = [];
	for (let routeIndex = 0; routeIndex < routes.length; routeIndex++) {
		const route = routes[routeIndex];
		if (route.slots) for (const [slotKey, slotModule] of Object.entries(route.slots)) {
			if (!slotModule.intercepts) continue;
			for (const intercept of slotModule.intercepts) {
				const sourceMatchPattern = intercept.sourceMatchPattern ?? null;
				const sourceMatchPatternParts = sourceMatchPattern ? sourceMatchPattern.split("/").filter(Boolean) : null;
				const ownerRouteIndex = sourceMatchPattern !== null ? patternToIndex.get(sourceMatchPattern) ?? routeIndex : routeIndex;
				interceptLookup.push({
					sourceRouteIndex: ownerRouteIndex,
					slotKey,
					slotId: typeof slotModule.id === "string" ? slotModule.id : null,
					targetPattern: intercept.targetPattern,
					targetPatternParts: intercept.targetPattern.split("/").filter(Boolean),
					sourceMatchPattern,
					sourceMatchPatternParts,
					sourcePageSegments: intercept.sourcePageSegments ?? null,
					interceptLayouts: intercept.interceptLayouts,
					interceptLayoutSegments: intercept.interceptLayoutSegments,
					interceptBranchSegments: intercept.interceptBranchSegments,
					interceptNotFoundBranchSegments: intercept.interceptNotFoundBranchSegments,
					__loadInterceptLayouts: intercept.__loadInterceptLayouts,
					page: intercept.page,
					__pageLoader: intercept.__pageLoader,
					notFound: intercept.notFound,
					__loadNotFound: intercept.__loadNotFound,
					notFoundTreePosition: intercept.notFoundTreePosition,
					__loadState: {
						page: intercept.page,
						pageLoading: null,
						notFound: intercept.notFound,
						notFoundLoading: null,
						interceptLayoutsLoading: null
					},
					params: intercept.params
				});
			}
		}
		if (route.siblingIntercepts) for (const intercept of route.siblingIntercepts) {
			const sourceMatchPattern = intercept.sourceMatchPattern ?? null;
			const sourceMatchPatternParts = sourceMatchPattern ? sourceMatchPattern.split("/").filter(Boolean) : null;
			interceptLookup.push({
				sourceRouteIndex: routeIndex,
				slotKey: SIBLING_PAGE_INTERCEPT_SLOT_KEY,
				slotId: typeof intercept.slotId === "string" ? intercept.slotId : null,
				targetPattern: intercept.targetPattern,
				targetPatternParts: intercept.targetPattern.split("/").filter(Boolean),
				sourceMatchPattern,
				sourceMatchPatternParts,
				sourcePageSegments: intercept.sourcePageSegments ?? null,
				interceptLayouts: intercept.interceptLayouts,
				interceptLayoutSegments: intercept.interceptLayoutSegments,
				interceptBranchSegments: intercept.interceptBranchSegments,
				interceptNotFoundBranchSegments: intercept.interceptNotFoundBranchSegments,
				__loadInterceptLayouts: intercept.__loadInterceptLayouts,
				page: intercept.page,
				__pageLoader: intercept.__pageLoader,
				notFound: intercept.notFound,
				__loadNotFound: intercept.__loadNotFound,
				notFoundTreePosition: intercept.notFoundTreePosition,
				__loadState: {
					page: intercept.page,
					pageLoading: null,
					notFound: intercept.notFound,
					notFoundLoading: null,
					interceptLayoutsLoading: null
				},
				params: intercept.params
			});
		}
	}
	return interceptLookup.sort(compareInterceptTargetPatterns);
}
function matchAppRscRoutePattern(urlParts, patternParts) {
	return matchRoutePattern(urlParts, patternParts);
}
function mergeMatchedParams(sourceParams, targetParams) {
	return Object.assign(createRouteParams(), sourceParams, targetParams);
}
function pickPatternParams(params, patternParts) {
	const picked = createRouteParams();
	for (const patternPart of patternParts) {
		if (!patternPart.startsWith(":")) continue;
		const paramName = patternPart.endsWith("+") || patternPart.endsWith("*") ? patternPart.slice(1, -1) : patternPart.slice(1);
		const value = params[paramName];
		if (value !== void 0) picked[paramName] = value;
	}
	return picked;
}
//#endregion
export { SIBLING_PAGE_INTERCEPT_SLOT_KEY, createAppRscRouteMatcher, matchAppRscRoutePattern };
