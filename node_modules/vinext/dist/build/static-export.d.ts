import { ResolvedNextConfig } from "../config/next-config.js";
import { Route } from "../routing/pages-router.js";
import { AppRoute } from "../routing/app-route-graph.js";

//#region src/build/static-export.d.ts
type StaticExportOptions = {
  /**
   * Absolute path to the pre-built Pages Router server bundle
   * (e.g. `dist/server/entry.js`).
   */
  pagesBundlePath: string; /** Discovered page routes (excludes API routes) */
  routes: Route[]; /** Discovered API routes */
  apiRoutes: Route[]; /** Pages directory path */
  pagesDir: string; /** Output directory for static files */
  outDir: string; /** Resolved next.config.js */
  config: ResolvedNextConfig;
};
type StaticExportResult = {
  /** Number of HTML files generated */pageCount: number; /** Generated file paths (relative to outDir) */
  files: string[]; /** Warnings encountered */
  warnings: string[]; /** Errors encountered (non-fatal, specific pages) */
  errors: Array<{
    route: string;
    error: string;
  }>;
};
/**
 * Run static export for Pages Router.
 *
 * Delegates to `prerenderPages()` in export mode.
 */
declare function staticExportPages(options: StaticExportOptions): Promise<StaticExportResult>;
type AppStaticExportOptions = {
  /** Discovered app routes */routes: AppRoute[];
  /**
   * App directory path. When provided, static export scans it for file-based
   * metadata assets such as icon.png and sitemap.xml.
   */
  appDir?: string;
  /**
   * Absolute path to the pre-built RSC handler bundle
   * (e.g. `dist/server/index.js`).
   */
  rscBundlePath: string; /** Output directory */
  outDir: string; /** Resolved next.config.js */
  config: ResolvedNextConfig;
};
/**
 * Run static export for App Router.
 *
 * Delegates to `prerenderApp()` in export mode.
 */
declare function staticExportApp(options: AppStaticExportOptions): Promise<StaticExportResult>;
//#endregion
export { AppStaticExportOptions, StaticExportOptions, StaticExportResult, staticExportApp, staticExportPages };