import { AppPageParams } from "./app-page-boundary.js";

//#region src/server/app-page-params.d.ts
declare function getAppPageSegmentParamName(segment: string): string | null;
declare function resolveAppPageSegmentParamScopeKeys(routeSegments: readonly string[] | null | undefined, treePosition: number): readonly string[];
declare function resolveAppPageSegmentParams(routeSegments: readonly string[] | null | undefined, treePosition: number, matchedParams: AppPageParams): AppPageParams;
declare function resolveAppPageBranchParams(branchSegments: readonly string[], treePosition: number, matchedParams: AppPageParams, scopedSegments?: readonly string[]): AppPageParams;
//#endregion
export { getAppPageSegmentParamName, resolveAppPageBranchParams, resolveAppPageSegmentParamScopeKeys, resolveAppPageSegmentParams };