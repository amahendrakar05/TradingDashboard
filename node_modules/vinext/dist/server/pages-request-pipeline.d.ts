import { NextHeader, NextI18nConfig, NextRedirect, NextRewrite } from "../config/next-config.js";
import { HeaderRecord } from "./request-pipeline.js";

//#region src/server/pages-request-pipeline.d.ts
type PagesRenderOptions = {
  isDataReq?: boolean;
  renderErrorPageOnMiss?: boolean;
  originalUrl?: string;
};
type FilesystemRoutePhase = "direct" | "beforeFiles" | "afterFiles" | "fallback";
type PageRouteMatch = {
  route: {
    isDynamic: boolean;
    pattern?: string;
    dataKind?: "static" | "server" | "none";
  };
};
declare function fetchWorkerFilesystemRoute(request: Request, requestPathname: string, phase: FilesystemRoutePhase, fetchAsset: (request: Request) => Promise<Response>): Promise<Response | false>;
type MiddlewareResult = {
  continue: boolean;
  redirectUrl?: string;
  redirectStatus?: number;
  rewriteUrl?: string;
  rewriteStatus?: number;
  status?: number;
  responseHeaders?: Iterable<[string, string]>;
  response?: Response;
  waitUntilPromises?: Promise<unknown>[];
};
type PagesPipelineDeps = {
  basePath: string;
  trailingSlash: boolean;
  i18nConfig: NextI18nConfig | null;
  configRedirects: NextRedirect[];
  configRewrites: {
    beforeFiles: NextRewrite[];
    afterFiles: NextRewrite[];
    fallback: NextRewrite[];
  };
  configHeaders: NextHeader[];
  hadBasePath: boolean;
  isDataReq: boolean;
  isDataRequest: boolean;
  hasMiddleware: boolean;
  ctx?: unknown;
  rawSearch?: string;
  configMatchPathname?: string;
  matchPageRoute?: ((pathname: string, request: Request) => PageRouteMatch | null) | null;
  runMiddleware?: ((request: Request, ctx: unknown, opts: {
    isDataRequest: boolean;
  }) => Promise<MiddlewareResult>) | null;
  renderPage?: ((request: Request, resolvedUrl: string, options?: PagesRenderOptions, stagedHeaders?: Headers) => Promise<Response>) | null;
  handleApi?: ((request: Request, apiUrl: string, ctx: unknown) => Promise<Response>) | null;
  /**
   * Optional override for proxying external rewrite destinations.
   * When supplied, the pipeline calls this instead of proxyExternalRequest(currentRequest, url).
   * Receives the pipeline's current request (with post-middleware headers applied) and the
   * external target URL. Dev adapters supply this to forward the original Node req body
   * (which is not included in the pipeline's body-less Web Request).
   */
  proxyExternal?: ((currentRequest: Request, externalUrl: string) => Promise<Response>) | null;
  /**
   * Optional filesystem/static-asset probe supplied by each runtime adapter.
   * Called post-middleware (so middleware can intercept/redirect public files) with the
   * original basePath-stripped pathname and the staged middleware response headers.
   * Node may write directly to `res` and return true; dev/Workers return a Response.
   * Resolves false to continue through rewrites, API routes, and page rendering.
   */
  serveFilesystemRoute?: ((requestPathname: string, stagedHeaders: HeaderRecord, phase: FilesystemRoutePhase) => Promise<boolean | Response>) | null;
};
/**
 * Wrap an adapter's `runMiddleware` callback so middleware receives the original
 * (pre-basePath-stripping) URL. Adapters strip the basePath before handing the
 * request to `runPagesRequest`, but Next.js passes the un-stripped URL to the
 * middleware adapter so `request.nextUrl.basePath` reflects whether the URL
 * actually had the basePath prefix. Requests outside the basePath
 * (`hadBasePath === false`) are passed through untouched so middleware sees
 * `nextUrl.basePath === ""` and can redirect them into the basePath
 * (see the middleware-base-path e2e test / #1830).
 *
 * Shared by the Node prod server (prod-server.ts) and the generated Pages
 * Router worker entry (deploy.ts) to keep the two adapters in sync.
 */
declare function wrapMiddlewareWithBasePath(runMiddleware: NonNullable<PagesPipelineDeps["runMiddleware"]>, basePath: string, hadBasePath: boolean): NonNullable<PagesPipelineDeps["runMiddleware"]>;
type PagesPipelineResult = {
  type: "response";
  response: Response;
  defaultContentType?: string;
} | {
  type: "handled";
} | {
  type: "render";
  resolvedUrl: string;
  renderOptions: PagesRenderOptions | undefined;
  stagedHeaders: HeaderRecord; /** Post-middleware request headers — dev adapters apply these to req.headers before SSR. */
  requestHeaders: Headers;
  middlewareStatus: number | undefined;
  isDataReq: boolean;
} | {
  type: "api";
  apiUrl: string;
  stagedHeaders: HeaderRecord; /** Post-middleware request headers — dev adapters apply these to req.headers before API handler. */
  requestHeaders: Headers;
  middlewareStatus: number | undefined;
} | {
  type: "next";
};
/**
 * Run the Pages Router request pipeline.
 *
 * ASSUMPTION: request already has internal headers filtered and basePath stripped.
 * The adapter is responsible for that pre-processing before calling runPagesRequest.
 * The adapter also handles: open-redirect guard, _next/static 404, image optimization,
 * _next/data normalization and classification: adapters must rewrite the data
 * URL to its page pathname and set `isDataReq` (the source of truth here), Node
 * decode/normalize/400, public-file serving.
 * runPagesRequest receives a "clean" request with basePath-stripped URL.
 */
declare function runPagesRequest(request: Request, deps: PagesPipelineDeps): Promise<PagesPipelineResult>;
//#endregion
export { FilesystemRoutePhase, MiddlewareResult, PagesPipelineDeps, PagesPipelineResult, PagesRenderOptions, fetchWorkerFilesystemRoute, runPagesRequest, wrapMiddlewareWithBasePath };