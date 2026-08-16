//#region src/build/standalone.d.ts
type StandaloneBuildOptions = {
  root: string;
  outDir: string;
  /**
   * Test hook: override vinext package root used for embedding runtime files.
   */
  vinextPackageRoot?: string;
};
type StandaloneBuildResult = {
  standaloneDir: string;
  copiedPackages: string[];
};
/**
 * Emit standalone production output for self-hosted deployments.
 *
 * Creates:
 * - <outDir>/standalone/server.js
 * - <outDir>/standalone/dist/{client,server}
 * - <outDir>/standalone/node_modules (runtime deps only)
 *
 * The set of packages copied into node_modules/ is determined by
 * `dist/server/vinext-externals.json`, which is written by the
 * `vinext:server-externals-manifest` Vite plugin during the production build.
 * It contains exactly the packages the server bundle imports at runtime
 * (i.e. those left external by the bundler), so no client-only deps are
 * included.
 */
declare function emitStandaloneOutput(options: StandaloneBuildOptions): StandaloneBuildResult;
//#endregion
export { emitStandaloneOutput };