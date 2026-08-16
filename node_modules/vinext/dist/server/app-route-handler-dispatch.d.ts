import { NextI18nConfig } from "../config/next-config.js";
import { ISRCacheEntry } from "./isr-cache.js";
import { RouteHandlerMiddlewareContext } from "./app-route-handler-response.js";
import { AppRouteHandlerModule } from "./app-route-handler-policy.js";
import { AppRouteDebugLogger, AppRouteParams, RouteHandlerCacheSetter } from "./app-route-handler-execution.js";

//#region src/server/app-route-handler-dispatch.d.ts
type AppRouteHandlerDispatchRoute = {
  pattern: string;
  routeHandler: AppRouteHandlerModule;
  routeSegments: string[];
};
type RouteHandlerCacheGetter = (key: string) => Promise<ISRCacheEntry | null>;
type RouteHandlerBackgroundRegenerationErrorContext = {
  routerKind: "App Router";
  routePath: string;
  routeType: "route";
};
type RouteHandlerBackgroundRegenerator = (key: string, renderFn: () => Promise<void>, errorContext?: RouteHandlerBackgroundRegenerationErrorContext) => void;
type DispatchAppRouteHandlerOptions = {
  basePath?: string;
  cleanPathname: string;
  clearRequestContext: () => void;
  draftModeSecret: string;
  expireSeconds?: number;
  i18n?: NextI18nConfig | null;
  isDevelopment?: boolean;
  isProduction?: boolean;
  isrDebug?: AppRouteDebugLogger;
  isrGet: RouteHandlerCacheGetter;
  isrRouteKey: (pathname: string) => string;
  isrSet: RouteHandlerCacheSetter;
  trailingSlash?: boolean;
  middlewareContext: RouteHandlerMiddlewareContext;
  middlewareRequestHeaders?: Headers | null;
  /**
   * `null` for non-dynamic routes, matching Next.js semantics. The dispatch
   * layer threads this through to the handler context unchanged so user code
   * (`params ? await params : null`) resolves to `null`.
   */
  params: AppRouteParams | null;
  request: Request;
  route: AppRouteHandlerDispatchRoute;
  scheduleBackgroundRegeneration: RouteHandlerBackgroundRegenerator;
  searchParams: URLSearchParams;
};
declare function dispatchAppRouteHandler(options: DispatchAppRouteHandlerOptions): Promise<Response>;
//#endregion
export { dispatchAppRouteHandler };