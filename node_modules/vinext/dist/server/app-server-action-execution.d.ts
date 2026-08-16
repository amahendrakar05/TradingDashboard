import { ActionRevalidationKind } from "../shims/cache-request-state.js";
import { AppRscRenderMode } from "./app-rsc-render-mode.js";
import { FetchCacheMode } from "../shims/fetch-cache.js";
import { HeadersAccessPhase } from "../shims/headers.js";
import { ReactFormState } from "react-dom/client";

//#region src/server/app-server-action-execution.d.ts
type AppPageParams = Record<string, string | string[]>;
type AppServerActionErrorReporter = (error: Error, request: {
  path: string;
  method: string;
  headers: Record<string, string>;
}, route: {
  routerKind: "App Router";
  routePath: string;
  routeType: "action";
}) => void;
type AppServerActionDecoder = (body: FormData) => Promise<unknown>;
type AppServerActionFormStateDecoder = (actionResult: unknown, body: FormData) => Promise<ReactFormState | undefined>;
type ReadFormDataWithLimit = (request: Request, maxBytes: number) => Promise<FormData>;
type ReadBodyWithLimit = (request: Request, maxBytes: number) => Promise<string>;
type AppServerActionReturnValue = {
  data: unknown;
  ok: true;
} | {
  data: unknown;
  ok: false;
};
type AppServerActionRoute = {
  page?: unknown;
  pattern: string;
  rootParamNames?: readonly string[];
  routeHandler?: unknown;
  routeSegments?: readonly string[];
  params?: readonly string[] | null;
  slots?: Readonly<Record<string, {
    default?: {
      default?: unknown;
    } | null;
    page?: {
      default?: unknown;
    } | null;
    slotPatternParts?: readonly string[] | null;
    slotParamNames?: readonly string[] | null;
  }>> | null;
};
/**
 * Side-effect headers captured during a progressive (no-JS) server action's
 * non-redirect execution. The caller (app-rsc-handler) must apply these to the
 * page render response so that `cookies().set(...)` and revalidation kinds
 * propagate to the browser. Without this, no-JS form submissions silently
 * lose cookie/header mutations — see issue #1483.
 *
 * Next.js' equivalent path mutates `res.setHeader('set-cookie', ...)` during
 * action execution (action-handler.ts → app-render.tsx), then `sendResponse`
 * merges those headers with the rendered Response. vinext works with Response
 * objects directly so the cookies must ride out via the result instead.
 */
type ProgressiveServerActionSideEffects = {
  /** `Set-Cookie` headers from `cookies().set(...)` / `cookies().delete(...)`. */pendingCookies: string[]; /** `Set-Cookie` header from `draftMode().enable()/disable()` (if any). */
  draftCookie: string | null | undefined; /** Resolved revalidation kind to emit via `x-action-revalidated`. */
  revalidationKind: ActionRevalidationKind;
};
type AppServerActionRouteRuntime = "edge" | "experimental-edge" | "nodejs" | null;
type ProgressiveServerActionResult = ({
  formState: ReactFormState | null;
  kind: "form-state";
} & ProgressiveServerActionSideEffects) | ({
  actionError: unknown;
  actionFailed: true;
  formState: null;
  kind: "form-state";
} & ProgressiveServerActionSideEffects);
type AppServerActionMatch<TRoute extends AppServerActionRoute> = {
  params: AppPageParams;
  route: TRoute;
};
type AppServerActionIntercept<TPage = unknown> = {
  matchedParams: AppPageParams;
  sourceMatchedParams?: AppPageParams;
  page: TPage;
  slotId?: string | null;
  slotKey: string;
  sourceRouteIndex: number;
};
type BuildServerActionPageElementOptions<TRoute extends AppServerActionRoute, TInterceptOpts> = {
  cleanPathname: string;
  interceptOpts: TInterceptOpts | undefined;
  isRscRequest: boolean;
  mountedSlotsHeader: string | null;
  params: AppPageParams;
  request: Request;
  route: TRoute;
  searchParams: URLSearchParams;
  renderMode: AppRscRenderMode;
  observeMetadataSearchParamsAccess?: boolean;
  observePageSearchParamsAccess?: boolean;
};
type AppServerActionRscModel<TElement> = {
  /**
   * Omitted when the action did not invalidate page data. This mirrors Next.js'
   * empty Flight payload for non-revalidating fetch actions: the client resolves
   * the action value without committing a visible router update.
   */
  root?: TElement;
  returnValue: AppServerActionReturnValue;
};
type RenderServerActionRscStreamOptions<TTemporaryReferences> = {
  onError: (error: unknown) => unknown;
  temporaryReferences: TTemporaryReferences;
};
type DecodeServerActionReplyOptions<TTemporaryReferences> = {
  temporaryReferences: TTemporaryReferences;
};
type HandleProgressiveServerActionRequestOptions = {
  actionId: string | null;
  allowedOrigins: string[]; /** Configured next.config `basePath`. Prefixed onto progressive Location targets. */
  basePath?: string;
  cleanPathname: string;
  clearRequestContext: () => void;
  contentType: string;
  decodeAction: AppServerActionDecoder;
  decodeFormState: AppServerActionFormStateDecoder;
  getAndClearPendingCookies: () => string[];
  getDraftModeCookieHeader: () => string | null | undefined;
  /**
   * Whether the posted-to route resolves to an App Router *page* (as opposed to
   * a route handler or no match). Multipart form POSTs to a page are always
   * server-action attempts in Next.js, so a body that decodes to no action must
   * surface as 404 action-not-found rather than rendering the page. Route
   * handlers (which run *after* this dispatch in vinext) legitimately receive
   * raw multipart POSTs, so they must still fall through. See issue #1340.
   */
  hasPageRoute: boolean;
  maxActionBodySize: number;
  middlewareHeaders: Headers | null;
  readFormDataWithLimit: ReadFormDataWithLimit;
  reportRequestError: AppServerActionErrorReporter;
  request: Request;
  setHeadersAccessPhase: (phase: HeadersAccessPhase) => HeadersAccessPhase;
};
type HandleServerActionRscRequestOptions<TElement, TRoute extends AppServerActionRoute, TInterceptOpts, TTemporaryReferences, TPage = unknown> = {
  actionId: string | null;
  allowedOrigins: string[]; /** Configured next.config `basePath`. Prefixed onto ACTION_REDIRECT_HEADER targets. */
  basePath?: string;
  buildPageElement: (options: BuildServerActionPageElementOptions<TRoute, TInterceptOpts>) => TElement;
  cleanPathname: string;
  clearRequestContext: () => void;
  contentType: string; /** Route selected at the request boundary before action execution. */
  currentRouteMatch: AppServerActionMatch<TRoute> | null; /** Request-aware pathname identity used for current-route interception lookup. */
  currentRoutePathname: string;
  createNotFoundElement: (routeId: string) => TElement;
  createPayloadRouteId: (pathname: string, interceptionContext: string | null) => string;
  createRscOnErrorHandler: (request: Request, pathname: string, pattern: string) => (error: unknown) => unknown;
  createTemporaryReferenceSet: () => TTemporaryReferences;
  decodeReply: (body: string | FormData, options: DecodeServerActionReplyOptions<TTemporaryReferences>) => Promise<unknown[]> | unknown[];
  draftModeSecret: string;
  /**
   * Hydrate a route's lazy page/route-handler modules before reading
   * `route.page` / `route.routeHandler` on action redirect targets and
   * re-render targets obtained via `matchRoute`/`getSourceRoute`. Idempotent.
   */
  ensureRouteLoaded?: (route: TRoute) => unknown;
  findIntercept: (pathname: string) => AppServerActionIntercept<TPage> | null;
  getAndClearPendingCookies: () => string[];
  getDraftModeCookieHeader: () => string | null | undefined;
  getRouteParamNames: (route: TRoute) => readonly string[];
  getSourceRoute: (sourceRouteIndex: number) => TRoute | undefined;
  isEdgeRuntime?: boolean;
  isRscRequest: boolean;
  loadServerAction: (actionId: string) => Promise<unknown>;
  matchRoute: (pathname: string) => AppServerActionMatch<TRoute> | null;
  maxActionBodySize: number; /** Verbatim `serverActions.bodySizeLimit` config string (e.g. "2mb") for the body-exceeded error. */
  maxActionBodySizeLabel: string;
  middlewareHeaders: Headers | null;
  middlewareStatus: number | null | undefined;
  mountedSlotsHeader: string | null;
  readBodyWithLimit: ReadBodyWithLimit;
  readFormDataWithLimit: ReadFormDataWithLimit;
  renderToReadableStream: (model: AppServerActionRscModel<TElement>, options: RenderServerActionRscStreamOptions<TTemporaryReferences>) => BodyInit | null | Promise<BodyInit | null>;
  reportRequestError: AppServerActionErrorReporter;
  resolveRouteFetchCacheMode?: (route: TRoute) => FetchCacheMode | null;
  resolveRouteDynamicConfig?: (route: TRoute) => string | null | undefined;
  resolveRouteRuntime?: (route: TRoute) => AppServerActionRouteRuntime;
  request: Request;
  sanitizeErrorForClient: (error: unknown) => unknown;
  searchParams: URLSearchParams;
  setHeadersAccessPhase: (phase: HeadersAccessPhase) => HeadersAccessPhase;
  setNavigationContext: (context: {
    params: AppPageParams;
    pathname: string;
    searchParams: URLSearchParams;
  }) => void;
  toInterceptOpts: (intercept: AppServerActionIntercept<TPage>) => TInterceptOpts;
};
declare function readActionBodyWithLimit(request: Request, maxBytes: number): Promise<string>;
declare function readActionFormDataWithLimit(request: Request, maxBytes: number): Promise<FormData>;
/**
 * Prepend the configured next.config `basePath` to a server-action redirect
 * target before it goes on the wire.
 *
 * `redirect("/foo")` called from a server action mounted at `/base/...` must
 * land the browser at `/base/foo`, mirroring how Next.js threads basePath
 * through `addPathPrefix(getURLFromRedirectError(err), basePath)` in
 * `app-render.tsx` for SSR redirects and in `action-handler.ts` for action
 * redirects.
 *
 * Idempotent and external-aware:
 *  - Empty basePath → returned unchanged.
 *  - External URLs (`http://`, `https://`, `data:`, protocol-relative `//`)
 *    are returned unchanged because the framework does not own those routes.
 *  - Targets that already start with the configured basePath are returned
 *    unchanged so this helper can be applied at any layer without risk of
 *    double-prefixing (`/base/base/foo`).
 *
 * Exported for tests. Used by both the progressive (no-JS form POST) and
 * RSC (`ACTION_REDIRECT_HEADER`) action redirect paths below.
 *
 * @see https://github.com/vercel/next.js/blob/canary/packages/next/src/server/app-render/action-handler.ts
 */
declare function applyActionRedirectBasePath(url: string, basePath: string): string;
declare function isProgressiveServerActionRequest(request: Pick<Request, "method">, contentType: string, actionId: string | null): boolean;
declare function handleProgressiveServerActionRequest(options: HandleProgressiveServerActionRequestOptions): Promise<Response | ProgressiveServerActionResult | null>;
declare function handleServerActionRscRequest<TElement, TRoute extends AppServerActionRoute, TInterceptOpts, TTemporaryReferences, TPage = unknown>(options: HandleServerActionRscRequestOptions<TElement, TRoute, TInterceptOpts, TTemporaryReferences, TPage>): Promise<Response | null>;
//#endregion
export { HandleProgressiveServerActionRequestOptions, HandleServerActionRscRequestOptions, applyActionRedirectBasePath, handleProgressiveServerActionRequest, handleServerActionRscRequest, isProgressiveServerActionRequest, readActionBodyWithLimit, readActionFormDataWithLimit };