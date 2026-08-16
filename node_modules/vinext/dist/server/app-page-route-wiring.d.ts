import { AppRouteSemanticIds } from "../routing/app-route-graph.js";
import { AppElements, AppElementsInterception, AppElementsSlotBinding } from "./app-elements-wire.js";
import { AppPageParams } from "./app-page-boundary.js";
import { ThenableParamsObserver } from "../shims/thenable-params.js";
import { Metadata, Viewport } from "../shims/metadata.js";
import { AppLayoutParamAccessTracker } from "./app-layout-param-observation.js";
import { AppRscRenderMode } from "./app-rsc-render-mode.js";
import { AppPageRenderIdentity } from "./app-page-render-identity.js";
import { resolveAppPageChildSegments } from "./app-page-segment-state.js";
import { ComponentType, ReactNode } from "react";

//#region src/server/app-page-route-wiring.d.ts
type AppPageComponentProps = {
  children?: ReactNode;
  error?: unknown;
  params?: unknown;
  reset?: () => void;
} & Record<string, unknown>;
type AppPageComponent = ComponentType<AppPageComponentProps>;
type AppPageErrorComponent = ComponentType<{
  error: unknown;
  reset: () => void;
}>;
type AppPageModule = Record<string, unknown> & {
  default?: AppPageComponent | null | undefined;
};
type AppPageErrorModule = Record<string, unknown> & {
  default?: AppPageErrorComponent | null | undefined;
};
type AppPageRouteWiringSlot<TModule extends AppPageModule = AppPageModule, TErrorModule extends AppPageErrorModule = AppPageErrorModule> = {
  /** Graph-owned semantic slot identity. */id?: string | null; /** Slot prop name passed to the owning layout (e.g. "modal" from @modal). */
  name: string;
  default?: TModule | null;
  configLayouts?: readonly (TModule | null | undefined)[] | null;
  configLayoutTreePositions?: readonly number[] | null;
  error?: TErrorModule | null;
  layout?: TModule | null;
  layoutIndex: number;
  loading?: TModule | null;
  notFound?: TModule | null;
  notFoundTreePosition?: number | null;
  page?: TModule | null;
  routeSegments?: readonly string[] | null;
  /**
   * Full URL pattern parts for the slot's mirrored sub-page. Set when the
   * slot's params may differ from the route's (e.g. inherited slot whose
   * dynamic markers have different names than the route's). The runtime
   * matches the request URL against these parts to extract slot params.
   */
  slotPatternParts?: readonly string[] | null; /** Param names captured by `slotPatternParts`, in order. */
  slotParamNames?: readonly string[] | null;
};
type AppPageRouteWiringRoute<TModule extends AppPageModule = AppPageModule, TErrorModule extends AppPageErrorModule = AppPageErrorModule> = {
  ids?: AppRouteSemanticIds | null;
  error?: TErrorModule | null;
  errorPaths?: readonly TErrorModule[] | null;
  errors?: readonly (TErrorModule | null | undefined)[] | null;
  errorTreePositions?: readonly number[] | null;
  layoutTreePositions?: readonly number[] | null;
  layouts: readonly (TModule | null | undefined)[];
  loading?: TModule | null;
  notFound?: TModule | null;
  notFounds?: readonly (TModule | null | undefined)[] | null;
  notFoundTreePosition?: number | null;
  forbidden?: TModule | null;
  forbiddenTreePosition?: number | null;
  forbiddens?: readonly (TModule | null | undefined)[] | null;
  unauthorized?: TModule | null;
  unauthorizedTreePosition?: number | null;
  unauthorizeds?: readonly (TModule | null | undefined)[] | null;
  routeSegments?: readonly string[];
  childrenRouteSegments?: readonly string[] | null;
  /**
   * Keyed by stable slot id (name + owner path), not necessarily the slot prop name.
   */
  slots?: Readonly<Record<string, AppPageRouteWiringSlot<TModule, TErrorModule>>> | null;
  childrenSlot?: {
    id: string;
    ownerTreePath: string;
    state: AppElementsSlotBinding["state"];
  } | null;
  /**
   * Static sibling segment names at each dynamic URL level for this route. Used
   * by the client router to determine if a cached prefetch of the dynamic
   * route can be reused when navigating to a static sibling URL.
   *
   * Mirrors Next.js's `staticSiblings` tuple element on the loader-tree
   * dynamic segments — see `.nextjs-ref/packages/next/src/shared/lib/app-router-types.ts`
   * (DynamicSegmentTuple) and the loader emit in
   * `packages/next/src/build/webpack/loaders/next-app-loader/index.ts`.
   *
   * Issue: https://github.com/cloudflare/vinext/issues/1525
   */
  staticSiblings?: readonly string[] | null;
  templateTreePositions?: readonly number[] | null;
  templates?: readonly (TModule | null | undefined)[] | null;
};
type AppPageSlotOverride<TModule extends AppPageModule = AppPageModule> = {
  branchSegments?: readonly string[] | null;
  layoutSegments?: readonly (readonly string[])[] | null;
  layoutModules?: readonly (TModule | null | undefined)[] | null;
  /**
   * The page module to render for this slot. Optional — when omitted, the
   * slot's existing `page` is used (e.g. when the override only changes the
   * slot's `params` for an inherited mirror with distinct param names).
   */
  pageModule?: TModule | null;
  params?: AppPageParams;
  props?: Readonly<Record<string, unknown>>;
  routeSegments?: readonly string[] | null;
};
type AppPageLayoutEntry<TModule extends AppPageModule = AppPageModule, TErrorModule extends AppPageErrorModule = AppPageErrorModule> = {
  errorModule?: TErrorModule | null | undefined;
  forbiddenModule?: TModule | null | undefined;
  id: string;
  layoutModule?: TModule | null | undefined;
  notFoundModule?: TModule | null | undefined;
  unauthorizedModule?: TModule | null | undefined;
  treePath: string;
  treePosition: number;
};
type BuildAppPageRouteElementOptions<TModule extends AppPageModule = AppPageModule, TErrorModule extends AppPageErrorModule = AppPageErrorModule> = {
  element: ReactNode;
  globalErrorModule?: TErrorModule | null;
  layoutParamAccess?: AppLayoutParamAccessTracker;
  makeThenableParams: MakeThenableParams;
  matchedParams: AppPageParams;
  metadataPlacement?: "body" | "head";
  resolvedMetadata: Metadata | null;
  resolvedMetadataPathname?: string;
  resolvedViewport: Viewport;
  streamingMetadata?: Promise<Metadata | null> | null;
  streamingMetadataOutlet?: Promise<unknown> | null;
  streamingMetadataOutletSuspended?: boolean;
  streamingMetadataTags?: Promise<Metadata | null> | null;
  trailingSlash?: boolean;
  rootForbiddenModule?: TModule | null;
  rootNotFoundModule?: TModule | null;
  rootUnauthorizedModule?: TModule | null;
  route: AppPageRouteWiringRoute<TModule, TErrorModule>;
  createPageElement?: (component: AppPageComponent, props: Readonly<Record<string, unknown>>) => ReactNode;
  searchParams?: unknown;
  slotOverrides?: Readonly<Record<string, AppPageSlotOverride<TModule>>> | null;
};
type MakeThenableParams = (params: AppPageParams, observer?: ThenableParamsObserver) => unknown;
type BuildAppPageElementsOptions<TModule extends AppPageModule = AppPageModule, TErrorModule extends AppPageErrorModule = AppPageErrorModule> = BuildAppPageRouteElementOptions<TModule, TErrorModule> & {
  interception?: AppElementsInterception | null;
  interceptionContext?: string | null;
  isRscRequest?: boolean;
  mountedSlotIds?: ReadonlySet<string> | null;
  renderIdentity?: AppPageRenderIdentity;
  renderMode?: AppRscRenderMode;
  routePath: string;
  sourcePageSegments?: readonly string[] | null;
};
declare function createAppPageTreePath(routeSegments: readonly string[] | null | undefined, treePosition: number): string;
declare function probeAppPageLayoutWithTracking<TModule extends AppPageModule>(options: {
  layoutIndex: number;
  layoutParamAccess: AppLayoutParamAccessTracker | undefined;
  makeThenableParams: MakeThenableParams;
  matchedParams: AppPageParams;
  route: Pick<AppPageRouteWiringRoute<TModule>, "layoutTreePositions" | "layouts" | "routeSegments">;
}): unknown;
declare function createAppPageLayoutEntries<TModule extends AppPageModule, TErrorModule extends AppPageErrorModule>(route: Pick<AppPageRouteWiringRoute<TModule, TErrorModule>, "errors" | "errorTreePositions" | "layoutTreePositions" | "layouts" | "notFounds" | "routeSegments"> & {
  forbiddens?: readonly (TModule | null | undefined)[] | null;
  unauthorizeds?: readonly (TModule | null | undefined)[] | null;
}): AppPageLayoutEntry<TModule, TErrorModule>[];
declare function createAppPageSourcePage(routeSegments: readonly string[] | null | undefined): string;
declare function createAppPageRouteBodyMetadata(metadata: Metadata | null, pathname: string, metadataPlacement: "body" | "head", trailingSlash?: boolean): ReactNode;
declare function buildAppPageElements<TModule extends AppPageModule, TErrorModule extends AppPageErrorModule>(options: BuildAppPageElementsOptions<TModule, TErrorModule>): AppElements;
//#endregion
export { AppPageErrorModule, AppPageModule, AppPageRouteWiringRoute, AppPageSlotOverride, buildAppPageElements, createAppPageLayoutEntries, createAppPageRouteBodyMetadata, createAppPageSourcePage, createAppPageTreePath, probeAppPageLayoutWithTracking, resolveAppPageChildSegments };