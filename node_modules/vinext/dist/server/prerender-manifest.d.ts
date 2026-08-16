//#region src/server/prerender-manifest.d.ts
type PrerenderManifestRoute = {
  route: string;
  status?: string;
  revalidate?: number | false;
  expire?: number;
  path?: string;
  router?: string;
  fallback?: boolean;
  headers?: Record<string, string>;
};
type PrerenderManifest = {
  buildId?: string;
  trailingSlash?: boolean;
  routes?: PrerenderManifestRoute[];
  pregeneratedConcretePaths?: Array<[string, string[]]>;
};
type PrerenderedPathSelectionOptions = {
  includeFallbackShells?: boolean;
  includeErrorDocuments?: boolean;
};
declare function readPrerenderManifest(manifestPath: string): PrerenderManifest | null;
declare function getRenderedAppRoutes(routes: PrerenderManifestRoute[]): PrerenderManifestRoute[];
/**
 * Returns true when `pathname` contains bracket-delimited route params,
 * indicating it is a fallback-shell placeholder (e.g. `/en/blog/[slug]`)
 * rather than a concrete rendered URL.
 */
declare function isFallbackShellArtifactPath(pathname: string, route?: PrerenderManifestRoute): boolean;
/**
 * Build the pregenerated concrete-path payload table from a prerender manifest.
 *
 * Filters out fallback-shell placeholder paths and groups remaining concrete
 * paths by route pattern. Returns an empty array when the manifest has no
 * rendered App routes or all routes are fallback-shell artifacts.
 */
declare function buildPregeneratedConcretePathTable(manifest: PrerenderManifest): Array<[string, string[]]>;
/**
 * Select concrete URL paths that were rendered by the prerender engine.
 *
 * This intentionally includes both App Router and Pages Router entries because
 * deploy-time cache warmup should exercise the same URLs the prerender phase
 * proved are statically renderable. PPR fallback-shell placeholder artifacts
 * and known error documents are excluded by default so warmup does not request
 * synthetic bracket paths or treat a healthy 404 response as a failed warmup.
 */
declare function getPrerenderedConcretePaths(manifest: PrerenderManifest, options?: PrerenderedPathSelectionOptions): string[];
//#endregion
export { PrerenderManifest, PrerenderManifestRoute, PrerenderedPathSelectionOptions, buildPregeneratedConcretePathTable, getPrerenderedConcretePaths, getRenderedAppRoutes, isFallbackShellArtifactPath, readPrerenderManifest };