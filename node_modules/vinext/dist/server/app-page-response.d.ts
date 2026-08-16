import { mergeMiddlewareResponseHeaders } from "./middleware-response-headers.js";

//#region src/server/app-page-response.d.ts
type AppPageMiddlewareContext = {
  headers: Headers | null;
  status: number | null;
};
type AppPageResponseTiming = {
  compileEnd?: number;
  handlerStart: number;
  renderEnd?: number;
  responseKind: "html" | "rsc";
};
type AppPageResponsePolicy = {
  cacheControl?: string;
  cacheState?: "MISS" | "STATIC";
};
type AppPagePrerenderCacheLife = {
  expire?: number;
  revalidate?: number;
};
type ResolveAppPageResponsePolicyBaseOptions = {
  isDraftMode: boolean;
  isDynamicError: boolean;
  isForceDynamic: boolean;
  isForceStatic: boolean;
  isProduction: boolean;
  expireSeconds?: number;
  revalidateSeconds: number | null;
};
type ResolveAppPageRscResponsePolicyOptions = {
  dynamicUsedDuringBuild: boolean;
} & ResolveAppPageResponsePolicyBaseOptions;
type ResolveAppPageHtmlResponsePolicyOptions = {
  dynamicUsedDuringRender: boolean;
  isProgressiveActionRender?: boolean;
  hasScriptNonce: boolean;
} & ResolveAppPageResponsePolicyBaseOptions;
type AppPageHtmlResponsePolicy = {
  shouldWriteToCache: boolean;
} & AppPageResponsePolicy;
type BuildAppPageRscResponseOptions = {
  dynamicStaleTimeSeconds?: number;
  isEdgeRuntime?: boolean;
  middlewareContext: AppPageMiddlewareContext;
  mountedSlotsHeader?: string | null;
  params?: Record<string, unknown>;
  policy: AppPageResponsePolicy;
  renderedPathAndSearch?: string | null;
  requestCacheLife?: AppPagePrerenderCacheLife | null;
  timing?: AppPageResponseTiming;
};
type BuildAppPageHtmlResponseOptions = {
  draftCookie?: string | null; /** Combined preload `Link` header value (React hints + font preloads), already capped. */
  linkHeader?: string;
  isEdgeRuntime?: boolean;
  middlewareContext: AppPageMiddlewareContext;
  policy: AppPageResponsePolicy;
  requestCacheLife?: AppPagePrerenderCacheLife | null;
  timing?: AppPageResponseTiming;
};
declare function resolveAppPageRscResponsePolicy(options: ResolveAppPageRscResponsePolicyOptions): AppPageResponsePolicy;
declare function resolveAppPageHtmlResponsePolicy(options: ResolveAppPageHtmlResponsePolicyOptions): AppPageHtmlResponsePolicy;
/**
 * Mirror Next.js' edge-runtime marker (set in edge-ssr-app.ts). Only routes
 * whose resolved segment config is `runtime = "edge"` should advertise it —
 * nodejs-runtime routes must not, otherwise downstream consumers can't tell
 * the configured runtime from the response. Centralized so every response
 * construction site can opt in without re-deriving the header name.
 */
declare function applyEdgeRuntimeHeader(headers: Headers, isEdgeRuntime: boolean | undefined): void;
declare function buildAppPageRscResponse(body: ReadableStream, options: BuildAppPageRscResponseOptions): Response;
declare function buildAppPageHtmlResponse(body: ReadableStream, options: BuildAppPageHtmlResponseOptions): Response;
//#endregion
export { AppPageMiddlewareContext, AppPageResponseTiming, applyEdgeRuntimeHeader, buildAppPageHtmlResponse, buildAppPageRscResponse, mergeMiddlewareResponseHeaders, resolveAppPageHtmlResponsePolicy, resolveAppPageRscResponsePolicy };