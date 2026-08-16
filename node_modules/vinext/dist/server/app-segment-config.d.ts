import { FetchCacheMode } from "../shims/fetch-cache.js";

//#region src/server/app-segment-config.d.ts
type AppRouteSegmentDynamic = "auto" | "error" | "force-dynamic" | "force-static";
type AppRouteSegmentConfigModule = {
  dynamic?: unknown;
  dynamicParams?: unknown;
  fetchCache?: unknown;
  generateStaticParams?: unknown;
  revalidate?: unknown;
  runtime?: unknown;
  unstable_dynamicStaleTime?: unknown;
};
type EffectiveAppPageSegmentConfig = {
  dynamicConfig?: AppRouteSegmentDynamic;
  dynamicParamsConfig?: boolean;
  dynamicStaleTimeSeconds?: number;
  fetchCache?: FetchCacheMode;
  revalidateSeconds: number | null;
  runtime?: "edge" | "experimental-edge" | "nodejs";
};
type ParallelAppPageSegmentConfigBranch = {
  configLayouts?: readonly (AppRouteSegmentConfigModule | null | undefined)[] | null;
  configLayoutTreePositions?: readonly number[] | null;
  layout?: AppRouteSegmentConfigModule | null;
  page?: AppRouteSegmentConfigModule | null;
  routeSegments?: readonly string[] | null;
};
type ResolveAppPageSegmentConfigOptions = {
  layouts?: readonly (AppRouteSegmentConfigModule | null | undefined)[];
  layoutTreePositions?: readonly number[];
  page?: AppRouteSegmentConfigModule | null;
  parallelBranches?: readonly (ParallelAppPageSegmentConfigBranch | null | undefined)[];
  parallelPages?: readonly (AppRouteSegmentConfigModule | null | undefined)[];
  parallelSegments?: readonly (AppRouteSegmentConfigModule | null | undefined)[];
  routeSegments?: readonly string[];
};
/**
 * Resolve the route segment config that applies to an App page route.
 *
 * Next.js collects config from every segment in the loader tree and reduces it
 * into the effective route config. The generated vinext entry already knows
 * the concrete layout/page modules for a route, so it should only describe
 * those modules and delegate the behavior to this helper.
 */
declare function resolveAppPageSegmentConfig(options: ResolveAppPageSegmentConfigOptions): EffectiveAppPageSegmentConfig;
declare function resolveAppPageFetchCacheMode(options: ResolveAppPageSegmentConfigOptions): FetchCacheMode | null;
/**
 * Resolve the `fetchCache` segment config exported by a route handler module.
 *
 * Route handlers have no layout chain, so the module's own export applies
 * directly. Mirrors upstream's app-route module, which copies
 * `userland.fetchCache` into the work store before invoking the handler.
 */
declare function resolveAppRouteHandlerFetchCacheMode(handler: Pick<AppRouteSegmentConfigModule, "fetchCache">): FetchCacheMode | null;
declare function isEdgeRuntime(runtime: string | undefined): boolean;
//#endregion
export { isEdgeRuntime, resolveAppPageFetchCacheMode, resolveAppPageSegmentConfig, resolveAppRouteHandlerFetchCacheMode };