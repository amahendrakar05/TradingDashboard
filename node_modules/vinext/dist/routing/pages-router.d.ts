import { ValidFileMatcher } from "./file-matcher.js";
import { patternToNextFormat } from "./route-validation.js";

//#region src/routing/pages-router.d.ts
type Route = {
  /** URL pattern, e.g. "/" or "/about" or "/posts/:id" */pattern: string; /** Pre-split pattern segments (computed once at scan time, reused per request) */
  patternParts: string[]; /** Absolute file path to the page component */
  filePath: string; /** Whether this is a dynamic route */
  isDynamic: boolean; /** Parameter names for dynamic segments */
  params: string[];
};
/**
 * Invalidate cached routes for a given pages directory.
 * Called by the file watcher when pages are added/removed.
 */
declare function invalidateRouteCache(pagesDir: string): void;
/**
 * Scan the pages/ directory and return a list of routes.
 * Results are cached — call invalidateRouteCache() when files change.
 *
 * Follows Next.js Pages Router conventions:
 * - pages/index.tsx -> /
 * - pages/about.tsx -> /about
 * - pages/posts/[id].tsx -> /posts/:id
 * - pages/[...slug].tsx -> /:slug+
 * - Ignores _app.tsx, _document.tsx, _error.tsx (Next.js special files)
 * - Ignores pages/api/ (handled separately later)
 */
declare function pagesRouter(pagesDir: string, pageExtensions?: readonly string[], matcher?: ValidFileMatcher): Promise<Route[]>;
/**
 * Match a URL path against a route pattern.
 * Returns the matched params or null if no match.
 */
declare function matchRoute(url: string, routes: Route[]): {
  route: Route;
  params: Record<string, string | string[]>;
} | null;
/**
 * Scan the pages/api/ directory and return API routes.
 * Results are cached — call invalidateRouteCache() when files change.
 *
 * Follows Next.js conventions:
 * - pages/api/hello.ts -> /api/hello
 * - pages/api/users/[id].ts -> /api/users/:id
 */
declare function apiRouter(pagesDir: string, pageExtensions?: readonly string[], matcher?: ValidFileMatcher): Promise<Route[]>;
//#endregion
export { Route, apiRouter, invalidateRouteCache, matchRoute, pagesRouter, patternToNextFormat };