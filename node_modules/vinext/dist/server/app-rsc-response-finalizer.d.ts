import { NextHeader, NextI18nConfig } from "../config/next-config.js";
import { RequestContext } from "../config/request-context.js";

//#region src/server/app-rsc-response-finalizer.d.ts
type FinalizeAppRscResponseOptions = {
  basePath: string;
  configHeaders: NextHeader[];
  /**
   * i18n config used to splice the default locale into unprefixed paths
   * before config header matching, so locale-aware `has`/`missing` rules
   * with `:locale` placeholders or `locale: false` overrides still match
   * default-locale URLs (issue #1336, item 4).
   */
  i18nConfig: NextI18nConfig | null;
  /**
   * Original pre-middleware request context.
   * Next.js evaluates config header has/missing conditions against the
   * unmodified incoming request, so callers must pass the snapshot taken
   * before middleware runs.
   */
  requestContext: RequestContext;
};
/**
 * Apply App Router response finalization that must happen outside individual
 * route dispatchers.
 *
 * Called once per request in the outer handler() wrapper, after all route
 * handling, so that every response path (page, route handler, server action,
 * metadata, not-found) gets headers applied consistently.
 *
 * Skips 3xx redirect responses. Response.redirect() creates immutable
 * headers that throw on mutation, and Next.js does not apply config headers
 * to redirects regardless.
 */
declare function finalizeAppRscResponse(response: Response, request: Request, options: FinalizeAppRscResponseOptions): Promise<Response>;
//#endregion
export { finalizeAppRscResponse };