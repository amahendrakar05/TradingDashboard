//#region src/plugins/rsc-client-shim-excludes.d.ts
declare const VINEXT_OPTIMIZE_DEPS_EXCLUDE: readonly string[];
declare const SSR_EXTERNAL_REACT_ENTRIES: readonly string[];
declare function mergeOptimizeDepsExclude(...excludeGroups: readonly (readonly string[])[]): string[];
//#endregion
export { SSR_EXTERNAL_REACT_ENTRIES, VINEXT_OPTIMIZE_DEPS_EXCLUDE, mergeOptimizeDepsExclude };