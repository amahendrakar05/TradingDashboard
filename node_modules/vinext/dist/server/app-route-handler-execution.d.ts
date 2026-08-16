import { NextI18nConfig } from "../config/next-config.js";
import { ExecutionContextLike } from "../shims/request-context.js";
import { NextRequest } from "../shims/server.js";
import { CachedRouteValue } from "../shims/cache-handler.js";
import { HeadersAccessPhase } from "../shims/headers.js";
import { RouteHandlerMiddlewareContext } from "./app-route-handler-response.js";
import { AppRouteHandlerModule } from "./app-route-handler-policy.js";

//#region src/server/app-route-handler-execution.d.ts
type AppRouteParams = Record<string, string | string[]>;
type AppRouteDynamicUsageFn = () => boolean;
type MarkAppRouteDynamicUsageFn = () => void;
/**
 * Route handler context.
 *
 * `params` is `null` for non-dynamic routes (no `[param]` segments) so that
 * user code like `params ? await params : null` resolves to `null`, matching
 * Next.js behavior. For dynamic routes it's a thenable that resolves to the
 * matched params object.
 *
 * See: test/e2e/app-dir/app-routes/app-custom-routes.test.ts in Next.js for
 * the authoritative assertion (`expect(meta.params).toEqual(null)`).
 */
type AppRouteHandlerFunction = (request: NextRequest, context: {
  params: AppRouteParams | null;
}) => Response | Promise<Response>;
type RouteHandlerCacheSetter = (key: string, data: CachedRouteValue, revalidateSeconds: number, tags: string[], expireSeconds?: number) => Promise<void>;
type AppRouteErrorReporter = (error: Error, request: {
  path: string;
  method: string;
  headers: Record<string, string>;
}, route: {
  routerKind: "App Router";
  routePath: string;
  routeType: "route";
}) => void;
type AppRouteDebugLogger = (event: string, detail: string) => void;
type RunAppRouteHandlerOptions = {
  basePath?: string;
  consumeDynamicUsage: AppRouteDynamicUsageFn;
  draftModeSecret?: string;
  dynamicConfig?: string;
  handlerFn: AppRouteHandlerFunction;
  i18n?: NextI18nConfig | null;
  isDraftMode?: boolean;
  trailingSlash?: boolean;
  markDynamicUsage: MarkAppRouteDynamicUsageFn;
  middlewareRequestHeaders?: Headers | null;
  /**
   * `null` for non-dynamic routes. Passed through to the handler context
   * unchanged — callers are expected to compute this from `route.isDynamic`.
   */
  params: AppRouteParams | null;
  request: Request;
  routePattern?: string;
  setHeadersAccessPhase?: (phase: HeadersAccessPhase) => HeadersAccessPhase;
};
type RunAppRouteHandlerResult = {
  dynamicUsedInHandler: boolean;
  response: Response;
};
declare function applyDraftModeCachePolicy(response: Response, isDraftMode: boolean): Response;
type ExecuteAppRouteHandlerOptions = {
  buildPageCacheTags: (pathname: string, extraTags: string[]) => string[];
  clearRequestContext: () => void;
  cleanPathname: string;
  executionContext: ExecutionContextLike | null;
  getAndClearPendingCookies: () => string[];
  getCollectedFetchTags: () => string[];
  getActiveDraftModeState?: () => boolean | null;
  getDraftModeCookieHeader: () => string | null | undefined;
  handler: AppRouteHandlerModule;
  isAutoHead: boolean;
  initialDraftModeCookie?: string | null;
  isDraftMode?: boolean;
  isProduction: boolean;
  isrDebug?: AppRouteDebugLogger;
  isrRouteKey: (pathname: string) => string;
  isrSet: RouteHandlerCacheSetter;
  method: string;
  middlewareContext: RouteHandlerMiddlewareContext;
  reportRequestError: AppRouteErrorReporter;
  expireSeconds?: number;
  revalidateSeconds: number | null;
  routePattern: string;
  setHeadersAccessPhase: (phase: HeadersAccessPhase) => HeadersAccessPhase;
} & RunAppRouteHandlerOptions;
declare function runAppRouteHandler(options: RunAppRouteHandlerOptions): Promise<RunAppRouteHandlerResult>;
declare function executeAppRouteHandler(options: ExecuteAppRouteHandlerOptions): Promise<Response>;
//#endregion
export { AppRouteDebugLogger, AppRouteDynamicUsageFn, AppRouteHandlerFunction, AppRouteParams, MarkAppRouteDynamicUsageFn, RouteHandlerCacheSetter, applyDraftModeCachePolicy, executeAppRouteHandler, runAppRouteHandler };