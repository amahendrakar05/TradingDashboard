import { NextI18nConfig } from "../config/next-config.js";
import { Route } from "../routing/pages-router.js";
import { ExecutionContextLike } from "../shims/request-context.js";
import { PagesReqResRequest, PagesReqResResponse, PagesRequestQuery } from "./pages-node-compat.js";

//#region src/server/pages-api-route.d.ts
type PagesApiRouteConfig = {
  runtime?: string;
  /**
   * `export const config = { api: { bodyParser: false | { sizeLimit: '4mb' } } }`
   * — controls whether vinext parses the request body for the route handler.
   *
   * `bodyParser: false` is critical for webhook handlers (Stripe, GitHub,
   * Slack, etc.) that need to read the raw bytes to verify an HMAC
   * signature. With it set, `req.body` is left undefined and the raw stream
   * remains available through the Node-readable request object.
   *
   * @see https://nextjs.org/docs/pages/building-your-application/routing/api-routes#custom-config
   */
  api?: {
    bodyParser?: boolean | {
      sizeLimit?: string | number;
    };
    responseLimit?: boolean | string | number;
    /**
     * `externalResolver: true` declares that the response is sent by an
     * external resolver (e.g. express/connect proxy middleware) that may
     * complete after the handler's promise settles. Next.js uses it to
     * suppress the "API resolved without sending a response" dev warning;
     * vinext additionally uses it to suppress the auto-`end()` safety net,
     * which would otherwise resolve an empty response before the external
     * resolver writes.
     *
     * @see https://nextjs.org/docs/pages/building-your-application/routing/api-routes#custom-config
     */
    externalResolver?: boolean;
  };
};
type PagesNodeApiRouteHandler = (req: PagesReqResRequest, res: PagesReqResResponse) => unknown;
type PagesEdgeApiRouteHandler = (request: Request) => Response | Promise<Response>;
type PagesApiRouteModule = {
  /**
   * `export const config = { runtime: 'edge' }` — historical Pages Router form.
   */
  config?: PagesApiRouteConfig;
  /**
   * `export const runtime = 'edge'` — bare export form. Next.js resolves the
   * effective runtime as `config.runtime ?? config.config?.runtime`, so a
   * top-level `runtime` export takes precedence over the nested config form.
   *
   * @see https://github.com/vercel/next.js/blob/canary/packages/next/src/build/analysis/get-page-static-info.ts
   */
  runtime?: string;
  default?: PagesNodeApiRouteHandler | PagesEdgeApiRouteHandler;
};
type PagesApiRouteMatch = {
  params: PagesRequestQuery;
  route: Pick<Route, "pattern"> & {
    module: PagesApiRouteModule;
  };
};
type HandlePagesApiRouteOptions = {
  /**
   * Per-request Cloudflare Workers `ExecutionContext`. When provided, the
   * API route runs inside `runWithExecutionContext(ctx, ...)` so any
   * `after()` (or other shim) call inside the handler can reach
   * `ctx.waitUntil()` via the ALS and keep the isolate alive past the
   * response. Omit on Node.js dev where no Workers lifecycle exists.
   */
  ctx?: ExecutionContextLike;
  match: PagesApiRouteMatch | null;
  reportRequestError?: (error: Error, routePattern: string) => void | Promise<void>;
  request: Request;
  url: string;
  nextConfig?: {
    basePath?: string;
    i18n?: NextI18nConfig | null;
    trailingSlash?: boolean;
  };
};
declare function handlePagesApiRoute(options: HandlePagesApiRouteOptions): Promise<Response>;
//#endregion
export { PagesApiRouteMatch, handlePagesApiRoute };