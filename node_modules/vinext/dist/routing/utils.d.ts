//#region src/routing/utils.d.ts
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
declare function sortRoutes<T extends {
  pattern: string;
}>(routes: T[]): T[];
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
declare function compareHybridRoutePatterns(pagesPattern: string, pagesIsDynamic: boolean, appPattern: string, appIsDynamic: boolean): "app" | "pages";
/**
 * Decode a filesystem or URL path segment while preserving encoded path delimiters.
 * Mirrors Next.js segment-wise decoding so "%5F" becomes "_" but "%2F" stays "%2F".
 */
declare function decodeRouteSegment(segment: string): string;
/**
 * Normalize a pathname for route matching by decoding each segment independently.
 * This prevents encoded slashes from turning into real path separators.
 */
declare function normalizePathnameForRouteMatch(pathname: string): string;
declare function splitPathnameForRouteMatch(pathname: string): string[];
/**
 * Strict pathname normalization for live request handling.
 * Throws on malformed percent-encoding so callers can return 400.
 */
declare function normalizePathnameForRouteMatchStrict(pathname: string): string;
/**
 * Build a params object from ordered entries, preserving insertion order.
 *
 * Used by trie matchers to reconstruct the params Record after collecting
 * entries in declaration order via DFS backtracking. Object.create(null)
 * avoids prototype pollution.
 *
 * @param entries - Ordered [paramName, value] tuples from forward traversal
 */
declare function buildParams(entries: Array<[string, string | string[]]>): Record<string, string | string[]>;
/**
 * Decode captured route params with `decodeURIComponent`, mirroring Next.js
 * route-matcher.ts:25-27. Mutates the params object in place. Catch-all
 * arrays are decoded element-wise. Malformed escapes are preserved (the
 * strict normalization layer rejects them at the request boundary).
 */
declare function decodeMatchedParams(params: Record<string, string | string[]>): void;
/**
 * Check whether a path segment is invisible in the URL (route groups, parallel
 * slots, "."). Single source of truth shared by the route graph (Node) and
 * browser-side bfcache identity logic. Lives in this browser-safe utils module
 * so importing it does not drag node:path/node:fs into the client bundle.
 */
declare function isInvisibleSegment(segment: string): boolean;
/** Split a pathname into its non-empty segments without decoding. */
declare function splitPathSegments(pathname: string): string[];
/**
 * Catch-all filesystem segment, e.g. `[...slug]`. Browser-safe predicate shared
 * with the route graph's segment parsing (dynamicParamNameFromSegment) so the
 * bracket conventions live in one place. The length guard rejects empty names
 * (`[...]`).
 */
declare function isCatchAllSegment(segment: string): boolean;
/**
 * Optional-catch-all filesystem segment, e.g. `[[...slug]]`. Unlike a catch-all,
 * this matches zero or more URL segments.
 */
declare function isOptionalCatchAllSegment(segment: string): boolean;
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
declare function countConsumedPathnameSegments(visibleTreePathSegments: readonly string[], pathnameSegmentCount: number): number;
//#endregion
export { buildParams, compareHybridRoutePatterns, countConsumedPathnameSegments, decodeMatchedParams, decodeRouteSegment, isCatchAllSegment, isInvisibleSegment, isOptionalCatchAllSegment, normalizePathnameForRouteMatch, normalizePathnameForRouteMatchStrict, sortRoutes, splitPathSegments, splitPathnameForRouteMatch };