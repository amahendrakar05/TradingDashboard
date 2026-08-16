import { MetadataFileRoute } from "./metadata-routes.js";
import { AppPageParams } from "./app-page-boundary.js";
import { ThenableParamsObserver } from "../shims/thenable-params.js";
import { Metadata, Viewport } from "../shims/metadata.js";
import { applyFileBasedMetadata } from "./file-based-metadata.js";

//#region src/server/app-page-head.d.ts
type AppPageSearchParams = Record<string, string | string[]>;
type AppPageHeadModule = Record<string, unknown>;
type ApplyAppPageFileBasedMetadata = typeof applyFileBasedMetadata;
type OrderedAppPageMetadataSource<TModule extends AppPageHeadModule = AppPageHeadModule> = {
  /** Preserve an empty result as the most specific file-metadata source. */includeWhenEmpty?: boolean;
  module: TModule;
  params: AppPageParams;
  routeSegments: readonly string[];
  searchParams?: AppPageSearchParams;
  searchParamsObserver?: ThenableParamsObserver;
};
type AppPageHeadParallelRoute<TModule extends AppPageHeadModule = AppPageHeadModule> = {
  layoutParams?: readonly AppPageParams[] | null;
  layoutModule?: TModule | null;
  layoutModules?: readonly (TModule | null | undefined)[] | null;
  layoutTreePositions?: readonly number[] | null;
  pageModule?: TModule | null;
  params?: AppPageParams | null;
  routeSegments?: readonly string[] | null;
};
type ActiveParallelRouteHeadInput<TModule extends AppPageHeadModule = AppPageHeadModule> = {
  head: AppPageHeadParallelRoute<TModule>;
  notFoundModule?: TModule | null;
  notFoundParams?: AppPageParams | null;
  ownerTreePosition: number;
};
type AppPageHeadSlot<TModule extends AppPageHeadModule = AppPageHeadModule> = {
  configLayouts?: readonly (TModule | null | undefined)[] | null;
  configLayoutTreePositions?: readonly number[] | null;
  layout?: TModule | null;
  layoutIndex?: number;
  notFound?: TModule | null;
  notFoundTreePosition?: number | null;
  page?: TModule | null;
  routeSegments?: readonly string[] | null;
};
type ResolveActiveParallelRouteHeadInputsOptions<TModule extends AppPageHeadModule = AppPageHeadModule> = {
  interceptLayouts?: readonly (TModule | null | undefined)[] | null;
  interceptBranchSegments?: readonly string[] | null;
  interceptLayoutSegments?: readonly (readonly string[])[] | null;
  interceptPage?: TModule | null;
  interceptNotFoundBranchSegments?: readonly string[] | null;
  interceptNotFound?: TModule | null;
  interceptNotFoundTreePosition?: number | null;
  interceptParams?: AppPageParams | null;
  interceptSlotKey?: string | null;
  interceptSourcePageSegments?: readonly string[] | null;
  layoutTreePositions?: readonly number[] | null;
  params: AppPageParams;
  routeSegments: readonly string[];
  slotParams?: Readonly<Record<string, AppPageParams>> | null;
  slots?: Record<string, AppPageHeadSlot<TModule>> | null;
};
type ResolveAppPageHeadOptions<TModule extends AppPageHeadModule = AppPageHeadModule> = {
  applyFileBasedMetadata?: ApplyAppPageFileBasedMetadata;
  /**
   * Configured next.config `basePath`. Threaded into `applyFileBasedMetadata`
   * so file-based metadata route URLs (icon, opengraph-image, manifest, ...)
   * emitted in <head> are prefixed with the basePath. Empty string when no
   * basePath is configured.
   */
  basePath?: string;
  fallbackOnFileMetadataError?: boolean;
  layoutModules: readonly (TModule | null | undefined)[];
  layoutTreePositions?: readonly number[] | null;
  metadataRoutes: readonly MetadataFileRoute[];
  pageModule?: TModule | null;
  parallelRoutes?: readonly AppPageHeadParallelRoute<TModule>[] | null;
  params: AppPageParams;
  routePath: string;
  routeSegments?: readonly string[] | null;
  searchParams?: URLSearchParams | null;
  searchParamsObserver?: ThenableParamsObserver;
};
type AppPageMetadataOutputOptions = {
  applyFileBasedMetadata?: ApplyAppPageFileBasedMetadata;
  basePath?: string;
  fallbackOnFileMetadataError?: boolean;
  metadataRoutes: readonly MetadataFileRoute[];
  params: AppPageParams;
  routePath: string;
  routeSegments?: readonly string[] | null;
};
type ResolveOrderedAppPageMetadataOptions<TModule extends AppPageHeadModule = AppPageHeadModule> = AppPageMetadataOutputOptions & {
  sources: readonly OrderedAppPageMetadataSource<TModule>[];
};
type ResolveAppPageHeadResult = {
  hasDynamicMetadata: boolean;
  hasSearchParams: boolean;
  metadata: Metadata | null;
  pageSearchParams: AppPageSearchParams;
  viewport: Viewport;
};
type PreparedAppPageHead = Omit<ResolveAppPageHeadResult, "metadata" | "viewport"> & {
  metadata: Promise<Metadata | null>;
  viewport: Promise<Viewport>;
};
type AppPageSearchParamsCollection = {
  hasSearchParams: boolean;
  pageSearchParams: AppPageSearchParams;
};
declare function resolveActiveParallelRouteHeadInputs<TModule extends AppPageHeadModule>(options: ResolveActiveParallelRouteHeadInputsOptions<TModule>): ActiveParallelRouteHeadInput<TModule>[];
declare function collectAppPageSearchParams(searchParams: URLSearchParams | null | undefined): AppPageSearchParamsCollection;
/**
 * Resolve an explicit metadata-source sequence.
 *
 * Route-specific conventions own source selection and ordering. This resolver
 * only supplies each source with its accumulated parent, merges the results,
 * and applies file-based metadata at the end.
 */
declare function resolveOrderedAppPageMetadata<TModule extends AppPageHeadModule>(options: ResolveOrderedAppPageMetadataOptions<TModule>): Promise<Metadata | null>;
declare function resolveAppPageHead<TModule extends AppPageHeadModule>(options: ResolveAppPageHeadOptions<TModule>): Promise<ResolveAppPageHeadResult>;
/**
 * Start metadata and viewport resolution without coupling their completion.
 *
 * Live document renders can place the metadata promise behind Suspense while
 * still waiting for viewport tags before the shell is emitted. Blocking
 * callers use {@link resolveAppPageHead} and observe the same result as before.
 */
declare function prepareAppPageHead<TModule extends AppPageHeadModule>(options: ResolveAppPageHeadOptions<TModule>): PreparedAppPageHead;
//#endregion
export { ActiveParallelRouteHeadInput, AppPageHeadModule, AppPageHeadParallelRoute, AppPageSearchParams, ApplyAppPageFileBasedMetadata, OrderedAppPageMetadataSource, PreparedAppPageHead, ResolveAppPageHeadResult, ResolveOrderedAppPageMetadataOptions, collectAppPageSearchParams, prepareAppPageHead, resolveActiveParallelRouteHeadInputs, resolveAppPageHead, resolveOrderedAppPageMetadata };