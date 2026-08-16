import { MetadataFileRoute } from "./metadata-routes.js";
import { AppPageParams } from "./app-page-boundary.js";
import { Metadata, Viewport } from "../shims/metadata.js";
import { ActiveParallelRouteHeadInput, AppPageHeadModule, ApplyAppPageFileBasedMetadata, OrderedAppPageMetadataSource } from "./app-page-head.js";

//#region src/server/app-page-http-access-fallback-metadata.d.ts
type HttpAccessFallbackMetadataPlanOptions<TModule extends AppPageHeadModule = AppPageHeadModule> = {
  boundaryModule?: TModule | null;
  boundaryParams: AppPageParams; /** Whether active branches may replace the fallback with their local not-found convention. */
  branchNotFoundConventions?: boolean;
  layoutModules: readonly (TModule | null | undefined)[];
  layoutTreePositions?: readonly number[] | null;
  parallelBranches?: readonly ActiveParallelRouteHeadInput<TModule>[] | null;
  params: AppPageParams;
  primaryParallelBranch?: ActiveParallelRouteHeadInput<TModule> | null;
  routeSegments?: readonly string[] | null;
};
type ResolveHttpAccessFallbackMetadataOptions<TModule extends AppPageHeadModule = AppPageHeadModule> = HttpAccessFallbackMetadataPlanOptions<TModule> & {
  applyFileBasedMetadata?: ApplyAppPageFileBasedMetadata;
  basePath?: string;
  fallbackOnFileMetadataError?: boolean;
  metadataRoutes: readonly MetadataFileRoute[];
  routePath: string;
};
declare function createHttpAccessFallbackMetadataPlan<TModule extends AppPageHeadModule>(options: HttpAccessFallbackMetadataPlanOptions<TModule>): OrderedAppPageMetadataSource<TModule>[];
declare function resolveHttpAccessFallbackMetadata<TModule extends AppPageHeadModule>(options: ResolveHttpAccessFallbackMetadataOptions<TModule>): Promise<Metadata | null>;
declare function resolveHttpAccessFallbackViewport<TModule extends AppPageHeadModule>(options: HttpAccessFallbackMetadataPlanOptions<TModule>): Promise<Viewport>;
//#endregion
export { createHttpAccessFallbackMetadataPlan, resolveHttpAccessFallbackMetadata, resolveHttpAccessFallbackViewport };