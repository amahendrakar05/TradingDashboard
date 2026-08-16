//#region src/routing/utils.ts
/**
* Route precedence — lower score is higher priority.
* Matches Next.js specificity rules:
* 1. Static routes first (scored by segment count, more = more specific)
* 2. Dynamic segments penalized by position
* 3. Catch-all comes after dynamic
* 4. Optional catch-all last
* 5. Lexicographic tiebreaker for determinism
*
* Key insight: routes with a static prefix before a dynamic/catch-all segment
* should have higher priority than bare dynamic/catch-all routes at the same
* depth. E.g., /_sites/:subdomain should match before /:subdomain, and
* /_sites/:subdomain/:slug* should match before /:slug*.
*
* The static-prefix reduction uses a small value (-50 per segment) so that:
*   - It beats the per-dynamic-segment penalty (100), placing prefix routes
*     above their no-prefix equivalents.
*   - It is small enough that infix-static bonuses (-500) and catch-all
*     penalties (1000+) are not swamped, preserving their relative ordering.
*     E.g. /:locale/blog/:path+ (with infix "blog") correctly beats /:locale/:path+
*     even when both share the same "locale-test" static prefix.
*   - Note: dynamic routes CAN score negative (e.g. /a/:b/c/:d = -346), but
*     this is harmless because the trie matcher (route-trie.ts) checks static
*     children before dynamic children at each node, so purely-static routes
*     still win at request time regardless of sort-order score.
*/
function routePrecedence(pattern) {
	const parts = pattern.split("/").filter(Boolean);
	let score = 0;
	let staticPrefixCount = 0;
	for (const p of parts) {
		if (p.startsWith(":") || p.endsWith("+") || p.endsWith("*")) break;
		staticPrefixCount++;
	}
	for (let i = 0; i < parts.length; i++) {
		const p = parts[i];
		if (p.endsWith("+")) score += 1e3 + i;
		else if (p.endsWith("*")) score += 2e3 + i;
		else if (p.startsWith(":")) score += 100 + i;
		else if (i >= staticPrefixCount) score -= 500;
	}
	if (parts.some((p) => p.startsWith(":") || p.endsWith("+") || p.endsWith("*")) && staticPrefixCount > 0) score -= staticPrefixCount * 50;
	return score;
}
/**
* Sort routes by precedence — lower score sorts first (higher priority), with a
* lexicographic tiebreaker on the pattern for determinism. Sorts in place and
* returns the same array (mirrors `Array.prototype.sort`).
*
* `routePrecedence` is a pure function of the pattern, so each pattern's score
* is computed exactly once up front (decorate-sort) instead of ~2·log n times
* by a comparator that re-parses on every comparison. The `localeCompare`
* tiebreaker already guarantees a total order, so the result is byte-identical
* to comparing precedence inline.
*
* Usage: sortRoutes(routes)
*/
function sortRoutes(routes) {
	const scores = /* @__PURE__ */ new Map();
	for (const route of routes) if (!scores.has(route.pattern)) scores.set(route.pattern, routePrecedence(route.pattern));
	return routes.sort((a, b) => {
		const diff = (scores.get(a.pattern) ?? 0) - (scores.get(b.pattern) ?? 0);
		return diff !== 0 ? diff : a.pattern.localeCompare(b.pattern);
	});
}
/**
* Single source of truth for hybrid App/Pages route ownership.
*
* Mirrors Next.js's DefaultRouteMatcherManager ordering: Pages providers
* are registered before App providers, then merged dynamic matchers sort
* together. Returns the router that should own a request/navigation to
* a URL that matched BOTH routers.
*
* Centralised so the server's request handling and the client's link /
* prefetch / programmatic-navigation paths all reach the same owner for
* the same (pages pattern, app pattern) pair. This intentionally implements
* Next.js's segment-tree ordering directly instead of vinext's broader
* `sortRoutes()` score heuristic. It only arbitrates two routes that already
* matched the same URL; each router's own trie ordering remains unchanged.
*
* Usage:
*   compareHybridRoutePatterns("/:slug", true, "/:slug", true)  // → "pages"
*   compareHybridRoutePatterns("/_sites/:slug*", true, "/:slug*", true)  // → "pages"
*   compareHybridRoutePatterns("/:path+", true, "/dashboard", false)  // → "app"
*   compareHybridRoutePatterns("/", false, "/", false)  // → "app"
*/
function compareHybridRoutePatterns(pagesPattern, pagesIsDynamic, appPattern, appIsDynamic) {
	if (pagesPattern === appPattern) throw new Error(`Conflicting app and page routes found for "${pagesPattern}"`);
	if (!pagesIsDynamic) return appIsDynamic ? "pages" : "app";
	if (!appIsDynamic) return "app";
	const pagesSegments = pagesPattern.split("/").filter(Boolean);
	const appSegments = appPattern.split("/").filter(Boolean);
	const segmentRank = (segment) => {
		if (!segment.startsWith(":")) return 0;
		if (segment.endsWith("*")) return 3;
		if (segment.endsWith("+")) return 2;
		return 1;
	};
	for (let index = 0; index < Math.min(pagesSegments.length, appSegments.length); index++) {
		const pagesRank = segmentRank(pagesSegments[index]);
		const appRank = segmentRank(appSegments[index]);
		if (pagesRank !== appRank) return pagesRank < appRank ? "pages" : "app";
	}
	if (pagesSegments.length !== appSegments.length) return pagesSegments.length < appSegments.length ? "pages" : "app";
	return "pages";
}
const PATH_DELIMITER_REGEX = /([/#?\\]|%(2f|23|3f|5c))/gi;
function encodePathDelimiters(segment) {
	return segment.replace(PATH_DELIMITER_REGEX, (char) => encodeURIComponent(char));
}
/**
* Decode a filesystem or URL path segment while preserving encoded path delimiters.
* Mirrors Next.js segment-wise decoding so "%5F" becomes "_" but "%2F" stays "%2F".
*/
function decodeRouteSegment(segment) {
	try {
		return encodePathDelimiters(decodeURIComponent(segment));
	} catch {
		return segment;
	}
}
/**
* Strict variant for request pipelines that should reject malformed percent-encoding.
*/
function decodeRouteSegmentStrict(segment) {
	return encodePathDelimiters(decodeURIComponent(segment));
}
/**
* Normalize a pathname for route matching by decoding each segment independently.
* This prevents encoded slashes from turning into real path separators.
*/
function normalizePathnameForRouteMatch(pathname) {
	return pathname.split("/").map((segment) => decodeRouteSegment(segment)).join("/");
}
function splitPathnameForRouteMatch(pathname) {
	return normalizePathnameForRouteMatch(pathname).split("/").filter(Boolean);
}
/**
* Strict pathname normalization for live request handling.
* Throws on malformed percent-encoding so callers can return 400.
*/
function normalizePathnameForRouteMatchStrict(pathname) {
	return pathname.split("/").map((segment) => decodeRouteSegmentStrict(segment)).join("/");
}
function decodeMatchedParam(value) {
	try {
		return decodeURIComponent(value);
	} catch {
		return value;
	}
}
/**
* Build a params object from ordered entries, preserving insertion order.
*
* Used by trie matchers to reconstruct the params Record after collecting
* entries in declaration order via DFS backtracking. Object.create(null)
* avoids prototype pollution.
*
* @param entries - Ordered [paramName, value] tuples from forward traversal
*/
function buildParams(entries) {
	const params = Object.create(null);
	for (const [key, value] of entries) params[key] = value;
	return params;
}
/**
* Decode captured route params with `decodeURIComponent`, mirroring Next.js
* route-matcher.ts:25-27. Mutates the params object in place. Catch-all
* arrays are decoded element-wise. Malformed escapes are preserved (the
* strict normalization layer rejects them at the request boundary).
*/
function decodeMatchedParams(params) {
	for (const key of Object.keys(params)) {
		const value = params[key];
		if (Array.isArray(value)) params[key] = value.map(decodeMatchedParam);
		else params[key] = decodeMatchedParam(value);
	}
}
/**
* Check whether a path segment is invisible in the URL (route groups, parallel
* slots, "."). Single source of truth shared by the route graph (Node) and
* browser-side bfcache identity logic. Lives in this browser-safe utils module
* so importing it does not drag node:path/node:fs into the client bundle.
*/
function isInvisibleSegment(segment) {
	if (segment === ".") return true;
	if (segment.startsWith("(") && segment.endsWith(")")) return true;
	if (segment.startsWith("@")) return true;
	return false;
}
/** Split a pathname into its non-empty segments without decoding. */
function splitPathSegments(pathname) {
	return pathname.split("/").filter(Boolean);
}
/**
* Catch-all filesystem segment, e.g. `[...slug]`. Browser-safe predicate shared
* with the route graph's segment parsing (dynamicParamNameFromSegment) so the
* bracket conventions live in one place. The length guard rejects empty names
* (`[...]`).
*/
function isCatchAllSegment(segment) {
	return segment.startsWith("[...") && segment.endsWith("]") && segment.length > 5;
}
/**
* Optional-catch-all filesystem segment, e.g. `[[...slug]]`. Unlike a catch-all,
* this matches zero or more URL segments.
*/
function isOptionalCatchAllSegment(segment) {
	return segment.startsWith("[[...") && segment.endsWith("]]") && segment.length > 7;
}
/**
* Count how many pathname segments a tree path's *visible* segments consume,
* given the total number of pathname segments available.
*
* This is the minimal pure slice of the canonical filesystem-segment →
* URL-segment mapping in `app-route-graph.ts` (`convertSegmentsToRouteParts`),
* extracted here so browser-side bfcache identity logic can share it without
* importing the Node-bound route graph module. `convertSegmentsToRouteParts`
* remains the source of truth for how each segment kind maps to a URL part.
*
* Each ordinary visible segment (static or `[x]`) consumes exactly one pathname
* segment. A catch-all (`[...x]`) is terminal and consumes every remaining
* pathname segment. An optional-catch-all (`[[...x]]`) is also terminal but may
* match zero segments, so it consumes only the remaining pathname segments
* (which is zero once preceding segments have already consumed the pathname) —
* never more than are actually present.
*
* @param visibleTreePathSegments URL-visible tree-path segments (callers must
*   pre-filter invisible segments via `isInvisibleSegment`).
* @param pathnameSegmentCount Total number of pathname segments available.
*/
function countConsumedPathnameSegments(visibleTreePathSegments, pathnameSegmentCount) {
	let consumed = 0;
	for (const segment of visibleTreePathSegments) {
		if (isCatchAllSegment(segment) || isOptionalCatchAllSegment(segment)) return Math.max(consumed, pathnameSegmentCount);
		consumed += 1;
	}
	return consumed;
}
//#endregion
export { buildParams, compareHybridRoutePatterns, countConsumedPathnameSegments, decodeMatchedParams, decodeRouteSegment, isCatchAllSegment, isInvisibleSegment, isOptionalCatchAllSegment, normalizePathnameForRouteMatch, normalizePathnameForRouteMatchStrict, sortRoutes, splitPathSegments, splitPathnameForRouteMatch };
