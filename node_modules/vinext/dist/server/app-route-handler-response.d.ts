import { CacheControlMetadata, CachedRouteValue } from "../shims/cache-handler.js";

//#region src/server/app-route-handler-response.d.ts
type RouteHandlerMiddlewareContext = {
  headers: Headers | null;
  status: number | null;
};
type BuildRouteHandlerCachedResponseOptions = {
  cacheControl?: CacheControlMetadata;
  cacheState: "HIT" | "STALE";
  expireSeconds?: number;
  isHead: boolean;
  revalidateSeconds: number;
};
type FinalizeRouteHandlerResponseOptions = {
  pendingCookies: string[];
  draftCookie?: string | null;
  isHead: boolean;
};
declare function applyRouteHandlerMiddlewareContext(response: Response, middlewareContext: RouteHandlerMiddlewareContext): Response;
declare function assertSupportedAppRouteHandlerResponse(response: Response): void;
declare function buildRouteHandlerCachedResponse(cachedValue: CachedRouteValue, options: BuildRouteHandlerCachedResponseOptions): Response;
declare function applyRouteHandlerRevalidateHeader(response: Response, revalidateSeconds: number, expireSeconds?: number, tags?: readonly string[]): void;
declare function markRouteHandlerCacheMiss(response: Response): void;
declare function buildAppRouteCacheValue(response: Response): Promise<CachedRouteValue>;
declare function finalizeRouteHandlerResponse(response: Response, options: FinalizeRouteHandlerResponseOptions): Response;
//#endregion
export { RouteHandlerMiddlewareContext, applyRouteHandlerMiddlewareContext, applyRouteHandlerRevalidateHeader, assertSupportedAppRouteHandlerResponse, buildAppRouteCacheValue, buildRouteHandlerCachedResponse, finalizeRouteHandlerResponse, markRouteHandlerCacheMiss };