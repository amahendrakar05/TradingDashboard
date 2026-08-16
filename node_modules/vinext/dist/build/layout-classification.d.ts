import { ClassificationReason, LayoutBuildClassification, ModuleGraphStaticReason } from "./layout-classification-types.js";

//#region src/build/layout-classification.d.ts
type ModuleGraphClassification = "static" | "needs-probe";
type ModuleGraphClassificationResult = {
  result: ModuleGraphClassification; /** First dynamic shim module ID encountered during BFS, when any. */
  firstShimMatch?: string;
};
type ModuleInfoProvider = {
  getModuleInfo(id: string): {
    importedIds: string[];
    dynamicImportedIds: string[];
  } | null;
};
type LayoutEntry = {
  /** Rollup/Vite module ID for the layout file. */moduleId: string; /** Directory depth from the app root, used to build the stable layout ID. */
  treePosition: number; /** Segment config source code extracted at build time, or null when absent. */
  segmentConfig?: {
    code: string;
  } | null;
};
type RouteForClassification = {
  layouts: readonly LayoutEntry[];
  routeSegments: string[];
};
/**
 * BFS traversal of a layout's dependency tree. If any transitive import
 * resolves to a dynamic shim path (headers, cache, server), the layout
 * cannot be proven static at build time and needs a runtime probe.
 *
 * The returned object carries the classification plus the first matching
 * shim module ID (when any). Operators use the shim ID via the debug
 * channel to trace why a layout was flagged for probing.
 */
declare function classifyLayoutByModuleGraph(layoutModuleId: string, dynamicShimPaths: ReadonlySet<string>, moduleInfo: ModuleInfoProvider): ModuleGraphClassificationResult;
declare function moduleGraphReason(graphResult: ModuleGraphClassificationResult & {
  result: "static";
}): ModuleGraphStaticReason;
declare function moduleGraphReason(graphResult: ModuleGraphClassificationResult): ClassificationReason;
declare function isStaticModuleGraphResult(graphResult: ModuleGraphClassificationResult): graphResult is ModuleGraphClassificationResult & {
  result: "static";
};
/**
 * Classifies all layouts across all routes using a two-layer strategy:
 *
 * 1. Segment config (Layer 1) — short-circuits to "static" or "dynamic"
 * 2. Module graph (Layer 2) — BFS for dynamic shim imports → "static" or "needs-probe"
 *
 * Shared layouts (same file appearing in multiple routes) are classified once
 * and deduplicated by layout ID.
 *
 * @internal Not called by production code. The `renderChunk` hook in
 * `index.ts` calls `classifyLayoutByModuleGraph` directly and composes
 * via the numeric-index manifest in `route-classification-manifest.ts`.
 * Used only by `tests/layout-classification.test.ts`.
 */
declare function classifyAllRouteLayouts(routes: readonly RouteForClassification[], dynamicShimPaths: ReadonlySet<string>, moduleInfo: ModuleInfoProvider): Map<string, LayoutBuildClassification>;
//#endregion
export { ModuleInfoProvider, classifyAllRouteLayouts, classifyLayoutByModuleGraph, isStaticModuleGraphResult, moduleGraphReason };