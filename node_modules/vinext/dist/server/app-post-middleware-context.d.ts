import { RequestContext } from "../config/request-context.js";

//#region src/server/app-post-middleware-context.d.ts
/**
 * Build a request context from the live ALS HeadersContext, which reflects
 * any x-middleware-request-* header mutations applied by middleware.
 * Used for afterFiles and fallback rewrite has/missing evaluation — these
 * run after middleware in the App Router execution order.
 *
 * Falls back to `requestContextFromRequest(request)` when no HeadersContext
 * is set (no middleware ran, or middleware didn't set request headers).
 */
declare function buildPostMwRequestContext(request: Request): RequestContext;
//#endregion
export { buildPostMwRequestContext };