//#region src/routing/route-pattern.d.ts
type RoutePatternParams = Record<string, string | string[]>;
declare function routePatternParts(pathname: string): string[];
declare function routePattern(pathname: string): string;
declare function fillRoutePatternSegments(pathname: string, params: RoutePatternParams): string | null;
declare function matchRoutePattern(urlParts: readonly string[], patternParts: readonly string[]): RoutePatternParams | null;
declare function matchRoutePatternRaw(urlParts: readonly string[], patternParts: readonly string[]): RoutePatternParams | null;
declare function matchRoutePatternPrefix(pathParts: readonly string[], patternParts: readonly string[]): boolean;
declare function matchRoutePatternWithOptionalDynamicSegments(pathParts: readonly string[], patternParts: readonly string[]): boolean;
/**
 * A single entry from `getStaticPaths().paths`.
 *
 * Next.js allows both shapes:
 *   - a raw string path, e.g. `"/blog/hello"`
 *   - an object `{ params, locale? }`
 *
 * See:
 *   https://nextjs.org/docs/pages/api-reference/functions/get-static-paths
 *   .nextjs-ref/packages/next/src/build/static-paths/pages.ts (the
 *     `typeof entry === 'string'` branch around line 89, and the object
 *     branch around line 132)
 */
type StaticPathsEntry = string | {
  params?: RoutePatternParams;
  locale?: string;
} | null | undefined;
/**
 * Result of {@link normalizeStaticPathsEntry}: either a params object, or a
 * descriptive error string the caller can surface as a per-route error result.
 */
type NormalizedStaticPathsEntry = {
  params: RoutePatternParams;
} | {
  error: string;
};
/**
 * Strip query string and a single trailing slash from a pathname.
 *
 * Mirrors the Next.js `removeTrailingSlash` helper used in
 * `.nextjs-ref/packages/next/src/build/static-paths/pages.ts`. Kept here so
 * both the build-time prerender and the request-time matchers normalize the
 * same way.
 */
declare function normalizeStaticPathname(pathname: string): string;
/**
 * Normalize a single `getStaticPaths` entry into a `{ params }` object.
 *
 * Handles both Next.js-supported shapes:
 *   - For a string entry, match it against `routePattern` to extract params,
 *     mirroring `_routeMatcher(cleanedEntry)` in
 *     `.nextjs-ref/packages/next/src/build/static-paths/pages.ts`. If the
 *     string does not match the pattern, Next.js throws; we return an
 *     `{ error }` result so the caller can record a per-route error instead
 *     of crashing the build.
 *   - For an object entry, require a `params` key (Next.js raises
 *     "A required parameter (X) was not provided..." otherwise).
 *
 * Note: this intentionally does NOT strip a locale prefix. The build pipeline
 * currently passes empty `locales` to `getStaticPaths`, so locale-prefixed
 * string entries are not produced. If/when i18n is wired through prerender,
 * locale handling should be added here, not duplicated at call sites.
 */
declare function normalizeStaticPathsEntry(entry: StaticPathsEntry, routePattern: string): NormalizedStaticPathsEntry;
//#endregion
export { RoutePatternParams, StaticPathsEntry, fillRoutePatternSegments, matchRoutePattern, matchRoutePatternPrefix, matchRoutePatternRaw, matchRoutePatternWithOptionalDynamicSegments, normalizeStaticPathname, normalizeStaticPathsEntry, routePattern, routePatternParts };