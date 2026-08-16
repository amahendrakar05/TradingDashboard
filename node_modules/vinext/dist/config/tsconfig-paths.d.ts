//#region src/config/tsconfig-paths.d.ts
type TsconfigPathResolution = {
  aliases: Record<string, string>;
  baseUrl: string | null;
};
/**
 * Read the project's tsconfig.json (or jsconfig.json) and return its
 * path-resolution settings as absolute paths.
 *
 * Returns an empty resolution if no config is found or no relevant compiler
 * options are configured.
 * Errors during parsing are swallowed — this is a best-effort helper that
 * must not break config loading.
 */
declare function loadTsconfigResolutionForRoot(projectRoot: string): TsconfigPathResolution;
/**
 * Back-compat helper for call sites that only need `compilerOptions.paths`.
 */
declare function loadTsconfigPathAliasesForRoot(projectRoot: string): Record<string, string>;
//#endregion
export { loadTsconfigPathAliasesForRoot, loadTsconfigResolutionForRoot };