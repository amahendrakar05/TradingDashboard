import { NextI18nConfig } from "../config/next-config.js";
import { NextRequest } from "../shims/server.js";

//#region src/server/app-route-handler-runtime.d.ts
declare const ROUTE_HANDLER_HTTP_METHODS: readonly ["GET", "HEAD", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"];
type RouteHandlerHttpMethod = (typeof ROUTE_HANDLER_HTTP_METHODS)[number];
type RouteHandlerModule = Partial<Record<RouteHandlerHttpMethod | "default", unknown>>;
/**
 * Checks whether a string is a recognized HTTP method for App Router route
 * handlers. Invalid methods must be rejected with 400 before any auto-OPTIONS
 * or 405 logic runs.
 *
 * @see https://github.com/vercel/next.js/blob/canary/packages/next/src/server/web/http.ts
 */
declare function isValidHTTPMethod(maybeMethod: string): maybeMethod is RouteHandlerHttpMethod;
declare function collectRouteHandlerMethods(handler: RouteHandlerModule): RouteHandlerHttpMethod[];
declare function buildRouteHandlerAllowHeader(exportedMethods: readonly string[]): string;
declare function isKnownDynamicAppRoute(pattern: string): boolean;
declare function markKnownDynamicAppRoute(pattern: string): void;
type RequestDynamicAccess = "request.headers" | "request.cookies" | "request.ip" | "request.geo" | "request.url" | "request.body" | "request.blob" | "request.json" | "request.text" | "request.arrayBuffer" | "request.formData";
type NextUrlDynamicAccess = "nextUrl.search" | "nextUrl.searchParams" | "nextUrl.url" | "nextUrl.href" | "nextUrl.toJSON" | "nextUrl.toString" | "nextUrl.origin";
type AppRouteDynamicRequestAccess = RequestDynamicAccess | NextUrlDynamicAccess;
type AppRouteRequestMode = "auto" | "force-static" | "error";
type TrackedAppRouteRequestOptions = {
  basePath?: string;
  i18n?: NextI18nConfig | null;
  trailingSlash?: boolean;
  middlewareHeaders?: Headers | null;
  onDynamicAccess?: (access: AppRouteDynamicRequestAccess) => void;
  requestMode?: AppRouteRequestMode;
  staticGenerationErrorMessage?: (expression?: string) => string;
};
type TrackedAppRouteRequest = {
  request: NextRequest;
  didAccessDynamicRequest(): boolean;
};
declare function createTrackedAppRouteRequest(request: Request, options?: TrackedAppRouteRequestOptions): TrackedAppRouteRequest;
//#endregion
export { RouteHandlerHttpMethod, RouteHandlerModule, buildRouteHandlerAllowHeader, collectRouteHandlerMethods, createTrackedAppRouteRequest, isKnownDynamicAppRoute, isValidHTTPMethod, markKnownDynamicAppRoute };