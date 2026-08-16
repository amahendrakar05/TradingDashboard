import { LayoutBuildClassification } from "./layout-classification-types.js";
import { Route } from "../routing/pages-router.js";
import { AppRoute } from "../routing/app-route-graph.js";
import { PrerenderResult } from "./prerender.js";

//#region src/build/report.d.ts
type RouteType = "static" | "isr" | "ssr" | "unknown" | "api";
type RouteRow = {
  pattern: string;
  type: RouteType; /** Only set for `isr` routes. */
  revalidate?: number;
  /**
   * True when the route was classified as `static` by speculative prerender
   * (i.e. was `unknown` from static analysis but rendered successfully).
   * Used by `formatBuildReport` to add a note in the legend.
   */
  prerendered?: boolean;
};
type AppRouteRenderEntry = Pick<AppRoute, "pagePath" | "routePath" | "parallelSlots">;
type StaticMiddlewareMatcherObject = {
  source: string;
  locale?: false;
  has?: Array<Record<string, string>>;
  missing?: Array<Record<string, string>>;
};
type StaticMiddlewareMatcher = string | Array<string | StaticMiddlewareMatcherObject>;
declare function getAppRouteRenderEntryPath(route: AppRouteRenderEntry): string | null;
/**
 * Returns true if the source code contains an export declaration with the given name.
 * For re-export specifiers, this intentionally follows Next.js' static analyzer
 * and checks the local/original binding name.
 * Handles all three common export forms:
 *   export function foo() {}
 *   export const foo = ...
 *   export { foo }
 */
declare function hasNamedExport(code: string, name: string): boolean;
/** Returns true when Next.js' analyzer recognizes the requested export name. */
declare function hasExportedName(code: string, name: string): boolean;
/**
 * Extracts the string value of `export const <name> = "value"`.
 * Handles TypeScript annotations/assertions and no-substitution template literals.
 * Returns null if the export is absent or not a string literal.
 */
declare function extractExportConstString(code: string, name: string): string | null;
declare function extractMiddlewareMatcherConfig(filePath: string): StaticMiddlewareMatcher | undefined;
/**
 * Extract the statically analyzable `config.matcher` value without first
 * narrowing it to vinext's runtime matcher type. Build validation needs the
 * raw value so malformed matcher objects are rejected instead of disappearing
 * as though no matcher had been configured.
 */
declare function extractMiddlewareMatcherConfigValue(filePath: string): unknown;
/**
 * Extracts the numeric value of `export const <name> = <number|false>`.
 * Supports integers, decimals, negative values, `Infinity`, and `false`.
 * `false` is returned as `Infinity` because `export const revalidate = false`
 * means "cache indefinitely" in Next.js segment config.
 * Handles TypeScript annotations/assertions and JavaScript numeric separators.
 * Returns null if the export is absent or not a number/`false`.
 */
declare function extractExportConstNumber(code: string, name: string): number | null;
/**
 * Extracts the `revalidate` value from inside a `getStaticProps` return object.
 * Looks for:  revalidate: <number>  or  revalidate: false  or  revalidate: Infinity
 *
 * Returns:
 *   number   — a positive revalidation interval (enables ISR)
 *   0        — treat as SSR (revalidate every request)
 *   false    — fully static (no revalidation)
 *   Infinity — fully static (treated same as false by Next.js)
 *   null     — no `revalidate` key found (fully static)
 */
declare function extractGetStaticPropsRevalidate(code: string): number | false | null;
/**
 * Classifies a layout file by its segment config exports (`dynamic`, `revalidate`).
 *
 * Returns a tagged `LayoutBuildClassification` carrying both the decision and
 * the specific segment-config field that produced it. `{ kind: "absent" }`
 * means no segment config is present and the caller should defer to the next
 * layer (module graph analysis).
 *
 * Unlike page classification, positive `revalidate` values are not meaningful
 * for layout skip decisions — ISR is a page-level concept. Only the extremes
 * (`revalidate = 0` → dynamic, `revalidate = Infinity` → static) are decisive.
 */
declare function classifyLayoutSegmentConfig(code: string): LayoutBuildClassification;
/**
 * Classifies a Pages Router page file by reading its source and examining
 * which data-fetching exports it contains.
 *
 * API routes (files under pages/api/) are always `api`.
 */
declare function classifyPagesRoute(filePath: string): {
  type: RouteType;
  revalidate?: number;
};
/**
 * Classifies an App Router route.
 *
 * @param pagePath   Absolute path to the page.tsx (null for API-only routes)
 * @param routePath  Absolute path to the route.ts handler (null for page routes)
 * @param isDynamic  Whether the URL pattern contains dynamic segments
 */
declare function classifyAppRoute(pagePath: string | null, routePath: string | null, isDynamic: boolean): {
  type: RouteType;
  revalidate?: number;
};
/**
 * Builds a sorted list of RouteRow objects from the discovered routes.
 * Routes are sorted alphabetically by path, matching filesystem order.
 *
 * When `prerenderResult` is provided, routes that were classified as `unknown`
 * by static analysis but were successfully rendered speculatively are upgraded
 * to `static` (confirmed by execution). The `prerendered` flag is set on those
 * rows so the formatter can add a legend note.
 */
declare function buildReportRows(options: {
  pageRoutes?: Route[];
  apiRoutes?: Route[];
  appRoutes?: AppRoute[];
  prerenderResult?: PrerenderResult;
}): RouteRow[];
/**
 * Formats a list of RouteRows into a Next.js-style build report string.
 *
 * Example output:
 *   Route (pages)
 *   ┌ ○ /
 *   ├ ◐ /blog/:slug  (60s)
 *   ├ ƒ /dashboard
 *   └ λ /api/posts
 *
 *   ○ Static  ◐ ISR  ƒ Dynamic  λ API
 */
declare function formatBuildReport(rows: RouteRow[], routerLabel?: string): string;
/**
 * Scans the project at `root`, classifies all routes, and prints the
 * Next.js-style build report to stdout.
 */
declare function printBuildReport(options: {
  root: string;
  pageExtensions: string[];
  prerenderResult?: PrerenderResult;
}): Promise<void>;
//#endregion
export { RouteRow, RouteType, StaticMiddlewareMatcher, buildReportRows, classifyAppRoute, classifyLayoutSegmentConfig, classifyPagesRoute, extractExportConstNumber, extractExportConstString, extractGetStaticPropsRevalidate, extractMiddlewareMatcherConfig, extractMiddlewareMatcherConfigValue, formatBuildReport, getAppRouteRenderEntryPath, hasExportedName, hasNamedExport, printBuildReport };