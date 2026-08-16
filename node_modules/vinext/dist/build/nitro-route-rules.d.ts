import { RouteRow } from "./report.js";

//#region src/build/nitro-route-rules.d.ts
type NitroRouteRuleConfig = Record<string, unknown> & {
  swr?: boolean | number;
  cache?: unknown;
  static?: boolean;
  isr?: boolean | number;
  prerender?: boolean;
};
type NitroRouteRules = Record<string, {
  swr: number;
}>;
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
declare function collectNitroRouteRules(options: {
  appDir?: string | null;
  pagesDir?: string | null;
  pageExtensions: string[];
}): Promise<NitroRouteRules>;
declare function generateNitroRouteRules(rows: RouteRow[]): NitroRouteRules;
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
declare function convertToNitroPattern(pattern: string): string;
declare function mergeNitroRouteRules(existingRouteRules: Record<string, NitroRouteRuleConfig> | undefined, generatedRouteRules: NitroRouteRules): {
  routeRules: Record<string, NitroRouteRuleConfig>;
  skippedRoutes: string[];
};
//#endregion
export { NitroRouteRuleConfig, collectNitroRouteRules, convertToNitroPattern, generateNitroRouteRules, mergeNitroRouteRules };