import { AppPageParams } from "./app-page-boundary.js";

//#region src/server/app-page-segment-state.d.ts
declare const APP_PAGE_SEGMENT_KEY = "__PAGE__";
declare function resolveAppPageChildSegments(routeSegments: readonly string[], treePosition: number, params: AppPageParams): string[];
declare function resolveAppPageSegmentStateKey(routeSegments: readonly string[], treePosition: number, params: AppPageParams): string;
declare function resolveAppPageRouteStateKey(routeSegments: readonly string[], params: AppPageParams): string;
declare function resolveAppPageLeafSegmentStateKey(routeSegments: readonly string[], params: AppPageParams): string;
//#endregion
export { APP_PAGE_SEGMENT_KEY, resolveAppPageChildSegments, resolveAppPageLeafSegmentStateKey, resolveAppPageRouteStateKey, resolveAppPageSegmentStateKey };