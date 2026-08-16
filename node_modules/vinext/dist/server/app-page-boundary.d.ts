//#region src/server/app-page-boundary.d.ts
type AppPageParams = Record<string, string | string[]>;
type ResolveAppPageHttpAccessBoundaryComponentOptions<TModule, TComponent> = {
  getDefaultExport: (module: TModule | null | undefined) => TComponent | null | undefined;
  rootForbiddenModule?: TModule | null;
  rootNotFoundModule?: TModule | null;
  rootUnauthorizedModule?: TModule | null;
  routeForbiddenModule?: TModule | null;
  routeNotFoundModule?: TModule | null;
  routeUnauthorizedModule?: TModule | null;
  statusCode: number;
};
type ResolveAppPageHttpAccessBoundaryModuleOptions<TModule> = {
  rootForbiddenModule?: TModule | null;
  rootNotFoundModule?: TModule | null;
  rootUnauthorizedModule?: TModule | null;
  routeForbiddenModule?: TModule | null;
  routeNotFoundModule?: TModule | null;
  routeUnauthorizedModule?: TModule | null;
  statusCode: number;
};
type ResolveAppPageParentHttpAccessBoundaryModuleOptions<TModule> = {
  layoutIndex: number;
  rootForbiddenModule?: TModule | null;
  rootNotFoundModule?: TModule | null;
  rootUnauthorizedModule?: TModule | null;
  routeForbiddenModules?: readonly (TModule | null | undefined)[] | null;
  routeNotFoundModules?: readonly (TModule | null | undefined)[] | null;
  routeUnauthorizedModules?: readonly (TModule | null | undefined)[] | null;
  statusCode: number;
};
type ResolveAppPageErrorBoundaryOptions<TModule, TComponent> = {
  getDefaultExport: (module: TModule | null | undefined) => TComponent | null | undefined;
  globalErrorModule?: TModule | null;
  errorModules?: readonly (TModule | null | undefined)[] | null;
  layoutErrorModules?: readonly (TModule | null | undefined)[] | null;
  pageErrorModule?: TModule | null;
};
type ResolveAppPageErrorBoundaryResult<TComponent> = {
  component: TComponent | null;
  isGlobalError: boolean;
};
type WrapAppPageBoundaryElementOptions<TElement, TLayoutModule, TLayoutComponent, TChildSegments, TGlobalErrorComponent> = {
  element: TElement;
  getDefaultExport: (module: TLayoutModule | null | undefined) => TLayoutComponent | null | undefined;
  globalErrorComponent?: TGlobalErrorComponent | null;
  includeGlobalErrorBoundary: boolean;
  isRscRequest: boolean;
  layoutModules: readonly (TLayoutModule | null | undefined)[];
  layoutTreePositions?: readonly number[] | null;
  makeThenableParams: (params: AppPageParams) => unknown;
  matchedParams: AppPageParams;
  renderErrorBoundary: (component: TGlobalErrorComponent, children: TElement) => TElement;
  renderLayout: (component: TLayoutComponent, children: TElement, params: unknown) => TElement;
  renderLayoutSegmentProvider?: (segmentMap: {
    children: TChildSegments;
  }, children: TElement) => TElement;
  resolveChildSegments?: (routeSegments: readonly string[], treePosition: number, params: AppPageParams) => TChildSegments;
  routeSegments?: readonly string[];
  skipLayoutWrapping?: boolean;
};
type AppPageBoundaryOnError = (error: unknown, requestInfo: unknown, errorContext: unknown) => unknown;
type RenderAppPageBoundaryResponseOptions<TElement> = {
  createHtmlResponse: (rscStream: ReadableStream<Uint8Array>, status: number) => Promise<Response>;
  createRscOnErrorHandler: () => AppPageBoundaryOnError;
  element: TElement;
  isEdgeRuntime?: boolean;
  isRscRequest: boolean;
  middlewareHeaders?: Headers | null;
  renderToReadableStream: (element: TElement, options: {
    onError: AppPageBoundaryOnError;
  }) => ReadableStream<Uint8Array>;
  status: number;
};
declare function resolveAppPageHttpAccessBoundaryComponent<TModule, TComponent>(options: ResolveAppPageHttpAccessBoundaryComponentOptions<TModule, TComponent>): TComponent | null;
declare function resolveAppPageHttpAccessBoundaryModule<TModule>(options: ResolveAppPageHttpAccessBoundaryModuleOptions<TModule>): TModule | null;
declare function resolveAppPageParentHttpAccessBoundaryModule<TModule>(options: ResolveAppPageParentHttpAccessBoundaryModuleOptions<TModule>): TModule | null;
/**
 * Like {@link resolveAppPageParentHttpAccessBoundaryModule}, but also returns
 * the layout index that owns the resolved boundary so callers can slice the
 * layouts array to skip rendering layouts below the boundary owner.
 *
 * `layoutIndex` is the per-layout index where the boundary lives, or `null` if
 * the resolved boundary is the root module (which conceptually sits above all
 * layouts when no layout-level boundary is present).
 *
 * Used by the page-error fast path to make `forbidden()` / `unauthorized()` /
 * `notFound()` escalate past intermediate layouts that lack a boundary file,
 * matching Next.js's `create-component-tree.tsx` behavior where the nearest
 * ancestor boundary owns the fallback subtree.
 *
 * @see https://github.com/vercel/next.js/blob/canary/packages/next/src/server/app-render/create-component-tree.tsx
 */
declare function resolveAppPageParentHttpAccessBoundary<TModule>(options: ResolveAppPageParentHttpAccessBoundaryModuleOptions<TModule>): {
  module: TModule | null;
  layoutIndex: number | null;
};
declare function resolveAppPageErrorBoundary<TModule, TComponent>(options: ResolveAppPageErrorBoundaryOptions<TModule, TComponent>): ResolveAppPageErrorBoundaryResult<TComponent>;
declare function wrapAppPageBoundaryElement<TElement, TLayoutModule, TLayoutComponent, TChildSegments, TGlobalErrorComponent>(options: WrapAppPageBoundaryElementOptions<TElement, TLayoutModule, TLayoutComponent, TChildSegments, TGlobalErrorComponent>): TElement;
declare function renderAppPageBoundaryResponse<TElement>(options: RenderAppPageBoundaryResponseOptions<TElement>): Promise<Response>;
//#endregion
export { AppPageParams, renderAppPageBoundaryResponse, resolveAppPageErrorBoundary, resolveAppPageHttpAccessBoundaryComponent, resolveAppPageHttpAccessBoundaryModule, resolveAppPageParentHttpAccessBoundary, resolveAppPageParentHttpAccessBoundaryModule, wrapAppPageBoundaryElement };