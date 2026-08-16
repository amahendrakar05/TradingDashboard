import { NextI18nConfig } from "../config/next-config.js";
import { ISRCacheEntry } from "./isr-cache.js";
import { HeadersAccessPhase } from "../shims/headers.js";
import { RouteHandlerMiddlewareContext } from "./app-route-handler-response.js";
import { AppRouteDebugLogger, AppRouteDynamicUsageFn, AppRouteHandlerFunction, AppRouteParams, MarkAppRouteDynamicUsageFn, RouteHandlerCacheSetter } from "./app-route-handler-execution.js";

//#region src/server/app-route-handler-cache.d.ts
type RouteHandlerCacheGetter = (key: string) => Promise<ISRCacheEntry | null>;
type RouteHandlerBackgroundRegenerator = (key: string, renderFn: () => Promise<void>) => void;
type RouteHandlerRevalidationContextRunner = (renderFn: () => Promise<void>) => Promise<void>;
type ReadAppRouteHandlerCacheOptions = {
  basePath?: string;
  buildPageCacheTags: (pathname: string, extraTags: string[]) => string[];
  cleanPathname: string;
  clearRequestContext: () => void;
  consumeDynamicUsage: AppRouteDynamicUsageFn;
  dynamicConfig?: string;
  getCollectedFetchTags: () => string[];
  handlerFn: AppRouteHandlerFunction;
  i18n?: NextI18nConfig | null;
  trailingSlash?: boolean;
  isAutoHead: boolean;
  isrDebug?: AppRouteDebugLogger;
  isrGet: RouteHandlerCacheGetter;
  isrRouteKey: (pathname: string) => string;
  isrSet: RouteHandlerCacheSetter;
  markDynamicUsage: MarkAppRouteDynamicUsageFn;
  middlewareContext: RouteHandlerMiddlewareContext; /** `null` for non-dynamic routes. See `AppRouteHandlerFunction` for details. */
  params: AppRouteParams | null;
  requestUrl: string;
  revalidateSearchParams: URLSearchParams;
  expireSeconds?: number;
  revalidateSeconds: number;
  routePattern: string;
  runInRevalidationContext: RouteHandlerRevalidationContextRunner;
  scheduleBackgroundRegeneration: RouteHandlerBackgroundRegenerator;
  setHeadersAccessPhase: (phase: HeadersAccessPhase) => HeadersAccessPhase;
  setNavigationContext: (context: {
    pathname: string;
    searchParams: URLSearchParams;
    params: AppRouteParams;
  } | null) => void;
};
declare function readAppRouteHandlerCacheResponse(options: ReadAppRouteHandlerCacheOptions): Promise<Response | null>;
//#endregion
export { readAppRouteHandlerCacheResponse };