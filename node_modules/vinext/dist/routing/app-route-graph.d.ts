import { ValidFileMatcher } from "./file-matcher.js";
import { isInvisibleSegment } from "./utils.js";

//#region src/routing/app-route-graph.d.ts
type InterceptingRoute = {
  /** The interception convention: "." | ".." | "../.." | "..." */convention: string; /** The URL pattern this intercepts (e.g. "/photos/:id") */
  targetPattern: string;
  /**
   * URL pattern of the *intercepting route* — the path that owns the slot
   * containing this interception marker, with route groups and `@slot`
   * segments stripped. Mirrors Next.js' `interceptingRoute` from
   * `extractInterceptionRouteInformation`.
   *
   * Used at request time to gate `findIntercept` against the Next-URL /
   * interception-context header: an intercept only fires when the source
   * pathname matches `^<sourceMatchPattern>(?:/.*)?$`. Without this gate
   * a direct RSC fetch to the intercept target would render the modal
   * instead of the underlying page.
   *
   * @see https://github.com/vercel/next.js/blob/canary/packages/next/src/lib/generate-interception-routes-rewrites.ts
   * @see https://github.com/vercel/next.js/blob/canary/packages/next/src/shared/lib/router/utils/interception-routes.ts
   */
  sourceMatchPattern: string; /** Absolute path to the intercepting page component */
  pagePath: string; /** Filesystem segments from app/ root to the intercepting page directory. */
  sourcePageSegments?: string[]; /** Absolute layout paths inside the intercepting route tree, outermost to innermost */
  layoutPaths: string[]; /** Normalized branch segments accumulated at each intercept layout. */
  layoutSegments?: string[][]; /** Full normalized interception branch segments through the page. */
  branchSegments?: string[]; /** Nearest not-found convention inside the interception branch. */
  notFoundPath?: string | null; /** Slot-root-relative branch segments used to scope not-found params. */
  notFoundBranchSegments?: string[]; /** Tree position relative to the normalized interception branch. */
  notFoundTreePosition?: number | null; /** Parameter names for dynamic segments */
  params: string[];
  /**
   * Synthetic page-carrier slot id for sibling (slot-less) interception.
   * Set only when the marker has no `@slot` wrapper; undefined for slot intercepts.
   */
  slotId?: string;
};
type ParallelSlot = {
  /** Graph-owned semantic slot identity. Required on AppRouteGraphParallelSlot. */id?: string; /** Stable slot identity (name + owning directory), used for route serialization keys. */
  key: string; /** Slot name (e.g. "team" from @team) */
  name: string; /** Absolute path to the @slot directory that owns this slot. Internal routing metadata. */
  ownerDir: string; /** Stable tree path for the directory whose layout owns this slot. */
  ownerTreePath: string; /** Whether the slot owner directory declares its own page component. */
  hasPage: boolean; /** Absolute path to the slot's page component */
  pagePath: string | null; /** Absolute path to the slot's default.tsx fallback */
  defaultPath: string | null; /** Absolute path to the slot's layout component (wraps slot content) */
  layoutPath: string | null; /** Nested active-branch layouts whose exports contribute route config. */
  configLayoutPaths?: string[]; /** Tree positions of configLayoutPaths relative to the slot root. */
  configLayoutTreePositions?: number[]; /** Absolute path to the slot's loading component */
  loadingPath: string | null; /** Absolute path to the slot's error component */
  errorPath: string | null; /** Nearest not-found convention for the slot's active branch. */
  notFoundPath?: string | null; /** Tree position of that convention relative to the slot root. */
  notFoundTreePosition?: number | null; /** Intercepting routes within this slot */
  interceptingRoutes: InterceptingRoute[];
  /**
   * The layout index (0-based, in route.layouts[]) that this slot belongs to.
   * Slots are passed as props to the layout at their directory level, not
   * necessarily the innermost layout. -1 means "innermost" (legacy default).
   */
  layoutIndex: number;
  /**
   * Filesystem segments from the slot's root directory to its active page.
   * Used at render time to compute segments for useSelectedLayoutSegment(slotName).
   * For a page at the slot root (@team/page.tsx), this is [].
   * For a sub-page (@team/members/page.tsx), this is ["members"].
   * null when the slot has no active page (showing default.tsx fallback).
   */
  routeSegments: string[] | null;
  /**
   * Full URL pattern parts for the slot's active page (owner prefix +
   * slot-relative pattern). Set when an inherited slot mirrors a sub-page
   * whose param names may differ from the route's. The runtime matches the
   * request URL against these parts to extract slot-specific params.
   */
  slotPatternParts?: string[];
  /**
   * Param names captured by `slotPatternParts`, in order of appearance.
   * Used at runtime to decide whether to extract slot-specific params or
   * reuse the route's matched params.
   */
  slotParamNames?: string[];
};
type AppRoute = {
  /** Graph-owned semantic identities. Required on AppRouteGraphRoute. */ids?: AppRouteSemanticIds; /** URL pattern, e.g. "/" or "/about" or "/blog/:slug" */
  pattern: string; /** Absolute file path to the page component */
  pagePath: string | null; /** Absolute file path to the route handler (route.ts) */
  routePath: string | null; /** Ordered list of layout files from root to leaf */
  layouts: string[]; /** Ordered list of all discovered template files from root to leaf (not necessarily aligned 1:1 with layouts) */
  templates: string[]; /** Parallel route slots (from @slot directories at the route's directory level) */
  parallelSlots: ParallelSlot[]; /** Stable implicit children-slot identity for parallel-slot sub-route families. */
  childrenSlot?: {
    id: string;
    ownerTreePath: string;
    state: "active" | "default" | "unmatched";
  };
  /**
   * Interception markers not wrapped in an `@slot` directory.
   * On soft-nav, the intercepting page replaces the entire page response.
   * Empty array when there are no sibling-style interception markers.
   */
  siblingIntercepts: InterceptingRoute[]; /** Loading component path */
  loadingPath: string | null; /** Error component path (leaf directory only) */
  errorPath: string | null;
  /**
   * Per-layout error boundary paths, aligned with the layouts array.
   * Each entry is the error.tsx at the same directory level as the
   * corresponding layout (or null if that level has no error.tsx).
   */
  layoutErrorPaths: (string | null)[]; /** Per-segment error boundary paths, aligned with errorTreePositions. */
  errorPaths?: string[]; /** Tree position (directory depth from app/ root) for each error boundary. */
  errorTreePositions?: number[]; /** Not-found component path (nearest, walking up from page dir) */
  notFoundPath: string | null; /** Tree position of the nearest not-found component's owning segment. */
  notFoundTreePosition?: number | null;
  /**
   * Not-found component paths per layout level (aligned with layouts array).
   * Each entry is the not-found.tsx at that layout's directory, or null.
   * Used to create per-layout NotFoundBoundary so that notFound() thrown from
   * a layout is caught by the parent layout's boundary (matching Next.js behavior).
   */
  notFoundPaths: (string | null)[];
  /**
   * Forbidden component paths per layout level (aligned with layouts array).
   * Each entry is the forbidden.tsx at that layout's directory, or null.
   * Used to create per-layout ForbiddenBoundary.
   */
  forbiddenPaths: (string | null)[]; /** Forbidden component path (403) at the route's directory level */
  forbiddenPath: string | null; /** Tree position of the nearest forbidden component's owning segment. */
  forbiddenTreePosition?: number | null; /** Unauthorized component path (401) at the route's directory level */
  unauthorizedPath: string | null; /** Tree position of the nearest unauthorized component's owning segment. */
  unauthorizedTreePosition?: number | null; /** Unauthorized component paths per layout level (aligned with layouts array). */
  unauthorizedPaths: (string | null)[];
  /**
   * Filesystem segments from app/ root to the route's directory.
   * Includes route groups and dynamic segments (as template strings like "[id]").
   * Used at render time to compute the child segments for useSelectedLayoutSegments().
   */
  routeSegments: string[];
  /**
   * Active filesystem segments for the default `children` slot.
   *
   * Synthetic routes materialized only from named parallel-slot pages still
   * use the full `routeSegments` for URL matching, params, and route identity,
   * but their children slot renders the parent's default.tsx. In that case the
   * active children segments remain at the parent route.
   */
  childrenRouteSegments?: string[]; /** Tree position (directory depth from app/ root) for each template. */
  templateTreePositions?: number[];
  /**
   * Tree position (directory depth from app/ root) for each layout.
   * Used to slice routeSegments and determine which segments are below each layout.
   * For example, root layout = 0, a layout at app/blog/ = 1, app/blog/(group)/ = 2.
   * Unlike the old layoutSegmentDepths, this counts ALL directory levels including
   * route groups and parallel slots.
   */
  layoutTreePositions: number[]; /** Whether this is a dynamic route */
  isDynamic: boolean; /** Parameter names for dynamic segments */
  params: string[]; /** Dynamic parameter names captured by the route's root layout. */
  rootParamNames?: string[]; /** Pre-split pattern segments (computed once at scan time, reused per request) */
  patternParts: string[];
};
type AppRouteSemanticIds = {
  route: string;
  page: string | null;
  routeHandler: string | null;
  rootBoundary: RootBoundaryId | null;
  layouts: readonly string[];
  templates: readonly string[];
  /**
   * Bridge map for the current route metadata shape: keyed by `slot.key`
   * (`name@relative/path` infrastructure id), value is the graph-owned semantic slot id.
   */
  slots: Readonly<Record<string, string>>;
};
type AppRouteGraphParallelSlot = ParallelSlot & {
  id: string;
};
type AppRouteGraphRoute = Omit<AppRoute, "ids" | "parallelSlots" | "rootParamNames"> & {
  ids: AppRouteSemanticIds;
  parallelSlots: AppRouteGraphParallelSlot[];
  rootParamNames: string[];
};
type Flavor<T, Brand extends string> = T & {
  readonly __flavor?: Brand;
};
type GraphVersion = Flavor<string, "GraphVersion">;
type RootBoundaryId = Flavor<string, "RootBoundaryId">;
type RouteManifestRoute = {
  id: string;
  pattern: string;
  patternParts: readonly string[];
  isDynamic: boolean;
  paramNames: readonly string[];
  rootParamNames: readonly string[];
  rootBoundaryId: RootBoundaryId | null;
  pageId: string | null;
  routeHandlerId: string | null;
  layoutIds: readonly string[];
  templateIds: readonly string[];
  slotIds: readonly string[];
};
type RouteManifestPage = {
  id: string;
  routeId: string;
  pattern: string;
};
type RouteManifestRouteHandler = {
  id: string;
  routeId: string;
  pattern: string;
};
type RouteManifestLayout = {
  id: string;
  treePath: string;
  patternParts: readonly string[];
  paramNames: readonly string[];
  rootBoundaryId: RootBoundaryId | null;
};
type RouteManifestTemplate = {
  id: string;
  treePath: string;
  rootBoundaryId: RootBoundaryId | null;
  ownerLayoutId: string | null;
  reset: {
    kind: "remountSubtree";
    treePath: string;
  };
};
type RouteManifestSlot = {
  id: string;
  key: string;
  name: string;
  ownerTreePath: string;
  ownerLayoutId: string | null;
  rootBoundaryId: RootBoundaryId | null;
  defaultId: string | null;
  hasDefault: boolean;
  hasPage: boolean;
};
type RouteManifestDefault = {
  id: string;
  slotId: string;
  ownerTreePath: string;
  ownerLayoutId: string | null;
  rootBoundaryId: RootBoundaryId | null;
};
type RouteManifestSlotBindingState = "active" | "default" | "unmatched";
type RouteManifestSlotBinding = {
  id: string;
  routeId: string;
  slotId: string;
  ownerLayoutId: string | null;
  state: RouteManifestSlotBindingState;
  defaultId: string | null;
  routeSegments: readonly string[] | null;
  slotPatternParts?: readonly string[];
  slotParamNames?: readonly string[];
};
type RouteManifestInterception = {
  id: string;
  sourcePattern: string;
  sourcePatternParts: readonly string[];
  targetPattern: string;
  targetPatternParts: readonly string[];
  slotId: string;
  ownerLayoutId: string | null;
  interceptingRouteId: string | null;
  targetRouteId: string | null;
};
type RouteManifestBoundaryOutcome = "error" | "forbidden" | "notFound" | "unauthorized";
type RouteManifestBoundary = {
  id: string;
  outcome: RouteManifestBoundaryOutcome;
  treePath: string;
  ownerLayoutId: string | null;
  rootBoundaryId: RootBoundaryId | null;
};
type RouteManifestRootBoundary = {
  id: RootBoundaryId;
  layoutId: string;
  treePath: string;
};
type StaticSegmentGraph = {
  routes: ReadonlyMap<string, RouteManifestRoute>;
  pages: ReadonlyMap<string, RouteManifestPage>;
  routeHandlers: ReadonlyMap<string, RouteManifestRouteHandler>;
  layouts: ReadonlyMap<string, RouteManifestLayout>;
  templates: ReadonlyMap<string, RouteManifestTemplate>;
  slots: ReadonlyMap<string, RouteManifestSlot>;
  defaults: ReadonlyMap<string, RouteManifestDefault>;
  slotBindings: ReadonlyMap<string, RouteManifestSlotBinding>;
  interceptions: ReadonlyMap<string, RouteManifestInterception>;
  interceptionsBySlotId: ReadonlyMap<string, readonly RouteManifestInterception[]>;
  boundaries: ReadonlyMap<string, RouteManifestBoundary>;
  rootBoundaries: ReadonlyMap<RootBoundaryId, RouteManifestRootBoundary>;
};
type RouteManifest = {
  graphVersion: GraphVersion;
  segmentGraph: StaticSegmentGraph;
};
/**
 * Build the App Router route graph by scanning `appDir`.
 */
declare function buildAppRouteGraph(appDir: string, matcher: ValidFileMatcher): Promise<{
  routes: AppRouteGraphRoute[];
  routeManifest: RouteManifest;
}>;
declare function computeRootParamNames(routeSegments: readonly string[], layoutTreePositions: readonly number[]): string[];
/**
 * Find the best route to attach a sibling intercept to, given the directory
 * that contains the interception marker.
 *
 * 1. Exact hit: a route whose page/handler lives directly in `dir`.
 * 2. Subtree hit: shallowest route whose page lives anywhere under `dir`
 *    (handles catch-all routes like `/templates/:catchAll+`).
 * 3. Ancestor walk: walk up the directory tree toward `appDir` looking for
 *    any of the above. This handles the case where the marker directory has
 *    no sibling pages at all (e.g. `deep/path/(...)target` with no
 *    `deep/path/page.tsx`).
 *
 * Comparisons happen in forward-slash space — inputs go through `toSlash` so
 * callers still holding native-separator paths hit the `current === appDir`
 * termination instead of overshooting the app root.
 *
 * Exported for tests.
 */
declare function findOwnerRouteForDir(dir: string, appDir: string, routes: readonly AppRouteGraphRoute[], routesByDir: Map<string, AppRouteGraphRoute>): AppRouteGraphRoute | null;
/**
 * Convert filesystem path segments to URL route parts, skipping invisible segments
 * (route groups, @slots, ".") and converting dynamic segment syntax to Express-style
 * patterns (e.g. "[id]" → ":id", "[...slug]" → ":slug+").
 */
declare function convertSegmentsToRouteParts(segments: readonly string[]): {
  urlSegments: string[];
  params: string[];
  isDynamic: boolean;
} | null;
/**
 * Returns the unique static sibling segment names at each dynamic URL level
 * of the matched route. Mirrors Next.js's `getStaticSiblingSegments` from
 * the next-app-loader: for `/products/[id]` with a sibling route at
 * `/products/sale`, the dynamic `[id]` segment has `staticSiblings: ['sale']`.
 *
 * The returned list flattens siblings across all dynamic positions and is
 * intended for the RSC payload — the client router uses it to determine if
 * a cached dynamic-route prefetch can be reused when navigating to a static
 * sibling URL.
 *
 * Ported from Next.js: packages/next/src/build/webpack/loaders/next-app-loader/index.ts
 * (getStaticSiblingSegments).
 *
 * Route group segments and parallel-route slot segments are part of the
 * filesystem tree but not the URL namespace — sibling computation is done on
 * the URL-level `patternParts`, so they are correctly transparent here.
 */
declare function computeAppRouteStaticSiblings(allRoutes: readonly {
  patternParts?: readonly string[] | null;
}[], matchedRoute: {
  patternParts?: readonly string[] | null;
}): string[];
//#endregion
export { AppRoute, AppRouteGraphRoute, AppRouteSemanticIds, GraphVersion, RootBoundaryId, RouteManifest, RouteManifestInterception, RouteManifestRootBoundary, RouteManifestRoute, RouteManifestSlotBinding, StaticSegmentGraph, buildAppRouteGraph, computeAppRouteStaticSiblings, computeRootParamNames, convertSegmentsToRouteParts, findOwnerRouteForDir, isInvisibleSegment };