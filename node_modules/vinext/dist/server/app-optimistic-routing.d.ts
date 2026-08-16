import { RouteManifest, RouteManifestRoute } from "../routing/app-route-graph.js";
import { AppElements } from "./app-elements-wire.js";
//#region src/server/app-optimistic-routing.d.ts
type OptimisticRouteMatch = {
  params: Record<string, string | string[]>;
  route: RouteManifestRoute;
};
type OptimisticRouteTemplate = {
  elements: AppElements;
  mountedSlotsHeader: string | null;
  pageElementIds: readonly string[];
  routeId: string;
};
type OptimisticNavigationPayload = {
  elements: AppElements;
  params: Record<string, string | string[]>;
  template: OptimisticRouteTemplate;
};
declare function getOptimisticRouteTemplateKey(options: {
  interceptionContext: string | null;
  mountedSlotsHeader: string | null;
  routeId: string;
}): string;
declare function getOptimisticPrefetchSourceKey(options: {
  cacheKey: string;
  interceptionContext: string | null;
  mountedSlotsHeader: string | null;
}): string;
declare function matchOptimisticRouteManifestRoute(options: {
  basePath: string;
  href: string;
  routeManifest: RouteManifest;
}): OptimisticRouteMatch | null;
declare function createOptimisticRouteTemplate(options: {
  allowLoadingShell?: boolean;
  basePath: string;
  elements: AppElements;
  href: string;
  interceptionContext: string | null;
  mountedSlotsHeader: string | null;
  routeManifest: RouteManifest;
}): OptimisticRouteTemplate | null;
declare function createOptimisticRouteElements(template: OptimisticRouteTemplate): AppElements;
declare function resolveOptimisticNavigationPayload(options: {
  basePath: string;
  href: string;
  interceptionContext: string | null;
  mountedSlotsHeader: string | null;
  routeManifest: RouteManifest;
  templates: ReadonlyMap<string, OptimisticRouteTemplate>;
}): OptimisticNavigationPayload | null;
//#endregion
export { OptimisticRouteTemplate, createOptimisticRouteElements, createOptimisticRouteTemplate, getOptimisticPrefetchSourceKey, getOptimisticRouteTemplateKey, matchOptimisticRouteManifestRoute, resolveOptimisticNavigationPayload };