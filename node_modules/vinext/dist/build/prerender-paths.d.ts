import { ResolvedNextConfig } from "../config/next-config.js";
import { VinextRouteRootConfig } from "../config/prerender.js";

//#region src/build/prerender-paths.d.ts
type PrerenderPathManifest = {
  buildId?: string;
  trailingSlash?: boolean;
  paths: string[];
};
declare const PRERENDER_PATH_DISCOVERY_ENV = "__VINEXT_PRERENDER_PATH_DISCOVERY";
declare const PRERENDER_PATHS_MANIFEST = "vinext-prerender-paths.json";
type EmitPrerenderPathManifestOptions = {
  root: string; /** Fully resolved Next.js config. Loaded from disk when omitted. */
  nextConfig?: ResolvedNextConfig;
  appDir?: string | null;
  pagesDir?: string | null;
  routeRootConfig?: VinextRouteRootConfig | null;
  pagesBundlePath?: string;
  rscBundlePath?: string;
};
declare function emitPrerenderPathManifest(options: EmitPrerenderPathManifestOptions): Promise<PrerenderPathManifest | null>;
//#endregion
export { PRERENDER_PATHS_MANIFEST, PRERENDER_PATH_DISCOVERY_ENV, PrerenderPathManifest, emitPrerenderPathManifest };