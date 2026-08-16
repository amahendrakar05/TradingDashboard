//#region src/server/app-route-tree-prefetch.d.ts
type DynamicParamTypeShort = "d" | "c" | "oc";
type TreePrefetchParam = {
  type: DynamicParamTypeShort;
  key: null;
  siblings: readonly string[] | null;
};
type AppRouteTreePrefetchSlot = {
  configLayouts?: readonly unknown[] | null;
  configLayoutTreePositions?: readonly number[] | null;
  default?: unknown;
  layout?: unknown;
  layoutIndex?: number;
  name: string;
  page?: unknown;
  routeSegments?: readonly string[] | null;
};
type AppRouteTreePrefetchRoute = {
  layoutTreePositions?: readonly number[];
  layouts?: readonly unknown[];
  page?: unknown;
  routeSegments: readonly string[];
  slots?: Readonly<Record<string, AppRouteTreePrefetchSlot>> | null;
};
type TreePrefetch = {
  name: string;
  param: TreePrefetchParam | null;
  prefetchHints: number;
  slots: null | Record<string, TreePrefetch>;
};
type RouteTreePrefetchResponseOptions = {
  buildId?: string | null;
  deploymentId?: string;
  prefetchInlining?: PrefetchInliningConfig;
};
type PrefetchInliningConfig = false | {
  maxBundleSize: number;
  maxSize: number;
};
declare function isRouteTreePrefetchRequest(request: Request): boolean;
declare function createRouteTreePrefetchResponse(route: AppRouteTreePrefetchRoute, options?: RouteTreePrefetchResponseOptions): Promise<Response>;
//#endregion
export { AppRouteTreePrefetchRoute, PrefetchInliningConfig, TreePrefetch, createRouteTreePrefetchResponse, isRouteTreePrefetchRequest };