import { ResolvedNextConfig } from "../config/next-config.js";
import { Route } from "../routing/pages-router.js";
import { AppRoute } from "../routing/app-route-graph.js";
import { MetadataFileRoute } from "../server/metadata-routes.js";
import { readPrerenderSecret } from "./server-manifest.js";
import { Server } from "node:http";

//#region src/build/prerender.d.ts
type PrerenderResult = {
  /** One entry per route (including skipped/error routes). */routes: PrerenderRouteResult[]; /** Additional generated files that are not represented as route entries. */
  outputFiles?: string[];
};
type PrerenderRouteResult = {
  /** The route's file-system pattern, e.g. `/blog/:slug`. */route: string;
  status: "rendered";
  outputFiles: string[];
  revalidate: number | false;
  expire?: number;
  /**
   * The concrete prerendered URL path, e.g. `/blog/hello-world`.
   * Only present when the route is dynamic and `path` differs from `route`.
   * Omitted for non-dynamic routes where pattern === path.
   */
  path?: string; /** Which router produced this route. Used by cache seeding. */
  router: "app" | "pages"; /** Response headers that must be replayed with the prerendered artifact. */
  headers?: Record<string, string>; /** Set to true when this is a PPR fallback shell. */
  fallback?: boolean;
} | {
  route: string;
  status: "skipped";
  reason: "ssr" | "dynamic" | "no-static-params" | "api" | "internal";
} | {
  route: string;
  status: "error";
  error: string;
  /**
   * Set when the error must fail the build in ALL modes (default included),
   * not just `output: 'export'`. Used for a thrown generateStaticParams /
   * getStaticPaths, which Next.js treats as a fatal build error rather than a
   * silently-skipped route. Refs cloudflare/vinext#1982
   */
  fatal?: true;
};
/** Called after each route is resolved (rendered, skipped, or error). */
type PrerenderProgressCallback = (update: {
  /** Routes completed so far (rendered + skipped + error). */completed: number; /** Total routes queued for rendering. */
  total: number; /** The route URL that just finished. */
  route: string; /** Its final status. */
  status: PrerenderRouteResult["status"];
}) => void;
type PrerenderOptions = {
  /**
   * 'default' — prerender static/ISR routes; skip SSR routes
   * 'export'  — same as default but SSR routes are errors
   */
  mode: "default" | "export"; /** Output directory for generated HTML/RSC files. */
  outDir: string;
  /**
   * Directory where `vinext-prerender.json` is written.
   * Defaults to `outDir` when omitted.
   * Set this when the manifest should land in a different location than the
   * generated HTML/RSC files (e.g. `dist/server/` while HTML goes to `dist/server/prerendered-routes/`).
   */
  manifestDir?: string; /** Resolved next.config.js. */
  config: ResolvedNextConfig;
  /**
   * Maximum number of routes rendered in parallel.
   * Defaults to `os.availableParallelism()` capped at 8.
   */
  concurrency?: number;
  /**
   * Called after each route finishes rendering.
   * Use this to display a progress bar in the CLI.
   */
  onProgress?: PrerenderProgressCallback;
  /**
   * When true, skip writing `vinext-prerender.json` at the end of this phase.
   * Use this when the caller (e.g. `runPrerender`) will merge results from
   * multiple phases and write a single unified manifest itself.
   */
  skipManifest?: boolean;
};
type PrerenderPagesOptions = {
  /** Discovered page routes (non-API). */routes: Route[]; /** Discovered API routes. */
  apiRoutes: Route[]; /** Pages directory path. */
  pagesDir: string;
  /**
   * Absolute path to the pre-built Pages Router server bundle
   * (e.g. `dist/server/entry.js`).
   *
   * Required when not passing `_prodServer`. For hybrid builds,
   * `runPrerender` passes a shared `_prodServer` instead.
   */
  pagesBundlePath?: string;
} & PrerenderOptions;
type PrerenderAppOptions = {
  /** Discovered app routes. */routes: AppRoute[]; /** Discovered file-based metadata routes. Used by static export. */
  metadataRoutes?: readonly MetadataFileRoute[];
  /**
   * Absolute path to the pre-built RSC handler bundle (e.g. `dist/server/index.js`).
   */
  rscBundlePath: string;
} & PrerenderOptions;
type PrerenderPagesOptionsInternal = PrerenderPagesOptions & {
  _prodServer?: {
    server: Server;
    port: number;
  };
  /**
   * Prerender secret to use when `_prodServer` is provided and `pagesBundlePath`
   * is absent (hybrid builds). Read from `vinext-server.json` by `runPrerender`
   * and passed here so `prerenderPages` does not need to locate the manifest itself.
   */
  _prerenderSecret?: string;
};
type PrerenderAppOptionsInternal = PrerenderAppOptions & {
  _prodServer?: {
    server: Server;
    port: number;
  };
};
/**
 * Reconstruct the RSC payload from a prerender HTML response by parsing the
 * inline bootstrap chunk scripts emitted by createRscEmbedTransform.
 *
 * Returns null when the HTML contains no chunk scripts at all — the caller
 * should fall back to a second handler invocation. This is reachable when
 * middleware short-circuits the App Router pipeline with a custom 200 HTML
 * response that never went through createRscEmbedTransform.
 *
 * Throws on partial or malformed embeds (chunks present but no done marker,
 * tampered chunk JSON, etc.) — those are real vinext-internal regressions.
 *
 * Safe regex usage: safeJsonStringify (used by createRscEmbedTransform) escapes
 * all '<' and '>' in the embedded JSON, preventing false </script> matches.
 */
declare function extractRscPayloadFromPrerenderedHtml(html: string): Uint8Array | null;
/**
 * Build a URL path from a route pattern and params.
 * "/posts/:id" + { id: "42" } → "/posts/42"
 * "/docs/:slug+" + { slug: ["a", "b"] } → "/docs/a/b"
 *
 * Throws a descriptive error rather than a cryptic `Cannot read properties of
 * undefined` if `params` itself is missing or required keys are absent — the
 * caller (prerenderPages / prerenderApp) catches this and surfaces it as a
 * per-route error result.
 */
declare function buildUrlFromParams(pattern: string, params: Record<string, string | string[]> | undefined | null): string;
/** Map of route patterns to generateStaticParams functions (or null/undefined). */
type StaticParamsMap = Record<string, ((opts: {
  params: Record<string, string | string[]>;
}) => Promise<unknown>) | null | undefined>;
/**
 * Resolve parent dynamic segment params for a route.
 * Handles top-down generateStaticParams resolution for nested dynamic routes.
 *
 * Uses the `staticParamsMap` (pattern → generateStaticParams) exported from
 * the production bundle.
 */
declare function resolveParentParams(childRoute: AppRoute, staticParamsMap: StaticParamsMap): Promise<Record<string, string | string[]>[]>;
/**
 * Run the prerender phase for Pages Router.
 *
 * Rendering is done via HTTP through a locally-spawned production server.
 * Works for both plain Node and Cloudflare Workers builds.
 * Route classification uses static file analysis (classifyPagesRoute);
 * getStaticPaths is fetched via a dedicated
 * `/__vinext/prerender/pages-static-paths?pattern=…` endpoint on the server.
 *
 * Returns structured results for every route (rendered, skipped, or error).
 * Writes HTML files to `outDir`. If `manifestDir` is set, writes
 * `vinext-prerender.json` there; otherwise writes it to `outDir`.
 */
declare function prerenderPages({
  routes,
  apiRoutes,
  pagesDir,
  outDir,
  config,
  mode,
  ...options
}: PrerenderPagesOptionsInternal): Promise<PrerenderResult>;
/**
 * Run the prerender phase for App Router.
 *
 * Starts a local production server and fetches every static/ISR route via HTTP.
 * Works for both plain Node and Cloudflare Workers builds — the CF Workers bundle
 * (`dist/server/index.js`) is a standard Node-compatible server entry, so no
 * wrangler/miniflare is needed. Writes HTML files, `.rsc` files, and
 * `vinext-prerender.json` to `outDir`.
 *
 * If the bundle does not exist, an error is thrown directing the user to run
 * `vinext build` first.
 *
 * Speculative static rendering: routes classified as 'unknown' (no explicit
 * config, non-dynamic URL) are attempted with an empty headers/cookies context.
 * If they succeed, they are marked as rendered. If they throw a DynamicUsageError
 * or fail, they are marked as skipped with reason 'dynamic'.
 */
declare function prerenderApp({
  routes,
  metadataRoutes,
  outDir,
  config,
  mode,
  rscBundlePath,
  ...options
}: PrerenderAppOptionsInternal): Promise<PrerenderResult>;
/**
 * Write `vinext-prerender.json` to `outDir`.
 *
 * Contains a flat list of route results used during testing and as a seed for
 * ISR cache population at production startup. The `buildId` is included so
 * the seeding function can construct matching cache keys.
 */
declare function writePrerenderIndex(routes: PrerenderRouteResult[], outDir: string, options?: {
  buildId?: string;
  trailingSlash?: boolean;
}): void;
//#endregion
export { PrerenderResult, PrerenderRouteResult, StaticParamsMap, buildUrlFromParams, extractRscPayloadFromPrerenderedHtml, prerenderApp, prerenderPages, readPrerenderSecret, resolveParentParams, writePrerenderIndex };