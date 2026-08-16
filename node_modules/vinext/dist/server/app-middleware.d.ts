import { NextI18nConfig } from "../config/next-config.js";
import { MiddlewareModule } from "./middleware-runtime.js";
import { FLIGHT_HEADERS } from "./headers.js";

//#region src/server/app-middleware.d.ts
type AppMiddlewareContext = {
  headers: Headers | null;
  requestHeaders: Headers | null;
  status: number | null;
};
type ApplyAppMiddlewareOptions = {
  basePath?: string;
  cleanPathname: string;
  context: AppMiddlewareContext;
  hadBasePath?: boolean;
  i18nConfig?: NextI18nConfig | null;
  /**
   * Whether the inbound request was recognized as a `_next/data` fetch from
   * trusted URL normalization before internal headers were stripped.
   */
  isDataRequest?: boolean;
  filePath?: string;
  isProxy: boolean;
  module: MiddlewareModule;
  request: Request;
  /**
   * Forwarded to `executeMiddleware` so the NextRequest exposes a NextURL with
   * the configured trailingSlash policy. This is what makes
   * `NextResponse.redirect(request.nextUrl)` emit a Location that honours
   * `trailingSlash`.
   */
  trailingSlash?: boolean;
};
type ApplyAppMiddlewareResult = {
  kind: "continue";
  cleanPathname: string;
  rewritten: boolean;
  search: string | null;
} | {
  kind: "response";
  response: Response;
};
declare function isExternalMiddlewareRewrite(rewriteUrl: string, request: Request): boolean;
declare function proxyExternalMiddlewareRewrite(request: Request, rewriteUrl: string, context: AppMiddlewareContext): Promise<Response>;
declare function applyAppMiddleware(options: ApplyAppMiddlewareOptions): Promise<ApplyAppMiddlewareResult>;
//#endregion
export { AppMiddlewareContext, ApplyAppMiddlewareOptions, ApplyAppMiddlewareResult, FLIGHT_HEADERS, applyAppMiddleware, isExternalMiddlewareRewrite, proxyExternalMiddlewareRewrite };