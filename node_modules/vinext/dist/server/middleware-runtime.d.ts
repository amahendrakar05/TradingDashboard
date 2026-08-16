import { NextI18nConfig } from "../config/next-config.js";
import { ExecutionContextLike } from "../shims/request-context.js";
import { NextFetchEvent, NextRequest } from "../shims/server.js";

//#region src/server/middleware-runtime.d.ts
type MiddlewareModule = Record<string, unknown>;
type MiddlewareResult = {
  continue: boolean;
  redirectUrl?: string;
  redirectStatus?: number;
  rewriteUrl?: string;
  rewriteStatus?: number;
  status?: number;
  responseHeaders?: Headers;
  response?: Response;
  waitUntilPromises?: Promise<unknown>[];
};
type MiddlewareHandler = (request: NextRequest, event: NextFetchEvent) => Response | undefined | void | Promise<Response | undefined | void>;
type ExecuteMiddlewareOptions = {
  basePath?: string;
  filePath?: string;
  /**
   * Whether the incoming request was inside the configured basePath. Drives
   * the `nextUrl.basePath` the middleware observes: in-basePath requests are
   * re-prefixed so NextURL reports the configured basePath, while
   * out-of-basePath ("absolute path") requests stay un-prefixed so middleware
   * sees `nextUrl.basePath === ""` (Next.js `getNextPathnameInfo` semantics —
   * see test/e2e/middleware-base-path "should execute from absolute paths").
   * When omitted it is derived from the request URL, which is correct for the
   * Pages prod/deploy adapters because they pass the original (un-stripped)
   * URL. Callers that pass an already-stripped URL (dev server, App Router)
   * must set this explicitly.
   */
  hadBasePath?: boolean;
  i18nConfig?: NextI18nConfig | null;
  includeErrorDetails?: boolean;
  /**
   * Whether the incoming request was recognized as a Next.js `_next/data`
   * fetch. Internal headers are stripped before middleware runs, so adapters
   * must derive and forward this from trusted URL normalization.
   */
  isDataRequest?: boolean;
  isProxy: boolean;
  module: MiddlewareModule;
  normalizedPathname?: string;
  request: Request;
  /**
   * The user's `trailingSlash` config. Plumbed into the NextRequest's NextURL
   * so `request.nextUrl.toString()` formats with the configured slash policy,
   * which feeds into `NextResponse.redirect(request.nextUrl)` Location headers.
   * Also used to normalize redirect Location pathnames returned via plain
   * `new URL('/x', req.url)`.
   */
  trailingSlash?: boolean;
};
type RunGeneratedMiddlewareOptions = ExecuteMiddlewareOptions & {
  ctx?: ExecutionContextLike;
};
declare function createMiddlewareMissingExportError(filePath: string | undefined, isProxy: boolean): Error;
declare function resolveMiddlewareModuleHandler(mod: MiddlewareModule, options: {
  filePath?: string;
  isProxy: boolean;
}): MiddlewareHandler;
declare function executeMiddleware(options: ExecuteMiddlewareOptions): Promise<MiddlewareResult>;
declare function runGeneratedMiddleware(options: RunGeneratedMiddlewareOptions): Promise<MiddlewareResult>;
//#endregion
export { MiddlewareModule, MiddlewareResult, createMiddlewareMissingExportError, executeMiddleware, resolveMiddlewareModuleHandler, runGeneratedMiddleware };