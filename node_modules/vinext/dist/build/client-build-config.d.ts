import { UserConfig } from "vite";

//#region src/build/client-build-config.d.ts
type ClientAssetFileNameInfo = {
  readonly name?: string;
  readonly names?: readonly string[];
  readonly originalFileName?: string;
  readonly originalFileNames?: readonly string[];
};
/**
 * Routes client assets into Next-compatible subtrees: `.css` sources go to
 * `<assetsDir>/css/`, everything else to `<assetsDir>/media/`. Returned as a
 * function so it can inspect every source-name candidate Rolldown records for
 * an asset (a single output asset can carry several `originalFileNames`).
 */
declare function createClientAssetFileNames(assetsDir: string): (assetInfo: ClientAssetFileNameInfo) => string;
/**
 * Create a manualChunks function for client builds.
 *
 * Splits the client bundle into:
 * - "framework" — React, ReactDOM, and scheduler (loaded on every page)
 * - "vinext"    — shared vinext runtime shims
 *
 * Route-owned client shims and all other vendor code are left to the bundler's
 * graph-based chunking so they stay behind their client-reference boundaries.
 *
 * Why not split every npm package into its own chunk?
 * - Per-package splitting (`vendor-X`) creates 50-200+ chunks for a
 *   typical app, far exceeding the ~25-request sweet spot for HTTP/2.
 * - gzip/brotli compress small files poorly — each file restarts with
 *   an empty dictionary, losing ~5-15% total compressed size vs fewer
 *   larger chunks (Khan Academy measured +2.5% wire size with 10x
 *   more files containing less raw code).
 * - ES module evaluation has per-module overhead that compounds on
 *   mobile devices.
 * - No major Vite-based framework (Remix, SvelteKit, Astro, TanStack)
 *   uses per-package splitting. Next.js only isolates packages >160KB.
 * - The bundler's graph-based splitting already handles the common case
 *   well: shared dependencies between routes get their own chunks,
 *   and route-specific code stays in route chunks.
 */
declare function createClientManualChunks(shimsDir: string, preserveRouteBoundaries?: boolean): (id: string) => string | undefined;
declare function createClientFileNameConfig(assetsDir: string): {
  entryFileNames: string;
  chunkFileNames: string;
};
declare function createClientCodeSplittingConfig(clientManualChunks: (id: string) => string | undefined): {
  minSize: number;
  groups: {
    name(moduleId: string): string | null;
  }[];
};
/**
 * Regex matching any {@link FRAMEWORK_PACKAGES} package inside `node_modules`.
 * Derived from the package list so the regex and {@link isRscFrameworkModule}
 * predicate can't drift.
 */
declare const RSC_FRAMEWORK_CHUNK_TEST: RegExp;
declare function isRscFrameworkModule(id: string): boolean;
/**
 * Output config that isolates React (and the RSC flight runtime) into a
 * dedicated "framework" chunk in the RSC server build. See
 * {@link RSC_FRAMEWORK_CHUNK_TEST} for the motivation (issue #1549). Framework
 * modules that are only reachable through dynamic imports must stay out of the
 * eager framework chunk (issue #2073).
 */
declare function createRscFrameworkChunkOutputConfig(): {
  codeSplitting: {
    groups: {
      name: string;
      test: RegExp;
      entriesAware: boolean;
    }[];
  };
};
/**
 * Returns Rolldown treeshake configuration for production client builds.
 *
 * The key optimization is moduleSideEffects: "no-external", which is supported
 * by Rolldown and provides the DCE benefits for barrel-exporting libraries. It
 * treats node_modules as side-effect-free while preserving side effects in
 * local code.
 */
declare function getClientTreeshakeConfig(): {
  moduleSideEffects: "no-external";
};
type VinextBuildConfig = NonNullable<UserConfig["build"]>;
type VinextBuildBundlerOptions = NonNullable<VinextBuildConfig["rolldownOptions"]>;
declare function getBuildBundlerOptions(build: UserConfig["build"] | undefined): VinextBuildBundlerOptions | undefined;
declare function withBuildBundlerOptions(bundlerOptions: VinextBuildBundlerOptions): Partial<VinextBuildConfig>;
//#endregion
export { RSC_FRAMEWORK_CHUNK_TEST, createClientAssetFileNames, createClientCodeSplittingConfig, createClientFileNameConfig, createClientManualChunks, createRscFrameworkChunkOutputConfig, getBuildBundlerOptions, getClientTreeshakeConfig, isRscFrameworkModule, withBuildBundlerOptions };