import { AppMiddlewareContext } from "./app-middleware.js";

//#region src/server/app-pages-bridge.d.ts
type PagesEntry = {
  handleApiRoute?: (request: Request, url: string) => Promise<Response> | Response;
  matchApiRoute?: (url: string, request: Request) => PagesRouteMatch | null;
  matchPageRoute?: (url: string, request: Request) => PagesRouteMatch | null;
  renderPage?: (request: Request, url: string, query: Record<string, unknown>, parsedUrl: unknown, middlewareRequestHeaders?: Headers | null, options?: {
    isDataReq?: boolean;
  }) => Promise<Response> | Response;
};
type PagesRouteMatch = {
  route: {
    isDynamic: boolean;
    pattern: string;
  };
};
type AppRouteMatch = {
  route: {
    isDynamic: boolean;
    pattern: string;
  };
};
type RenderPagesFallbackDependencies = {
  loadPagesEntry: () => Promise<PagesEntry> | PagesEntry;
  buildRequestHeaders: (requestHeaders: Headers, middlewareRequestHeaders: Headers) => Headers | null;
  decodePathParams: (pathname: string) => string;
  applyRouteHandlerMiddlewareContext: (response: Response, middlewareContext: AppMiddlewareContext) => Response;
  /**
   * Returns the `__prerender_bypass` Set-Cookie header emitted by a
   * `draftMode().enable()`/`disable()` call inside middleware, if any. Reading
   * it clears it. Mirrors how App Router route handlers and page renders surface
   * the middleware-enabled draft cookie so the same flow works when the request
   * falls through to a Pages Router route.
   *
   * Note: this closes the draft-mode flow for production (Cloudflare Workers /
   * Node), where middleware runs inline in the same RSC handler context that
   * builds this fallback. In hybrid *dev*, middleware runs in a separate Vite
   * Pages SSR runner and `draftMode()` inside middleware is not yet permitted
   * there (it throws a scope error before any cookie is set), so this getter
   * returns `null` and no cookie is appended. That dev limitation is pre-existing
   * and tracked separately from #1520.
   */
  getDraftModeCookieHeader: () => string | null | undefined;
};
type RenderPagesFallbackOptions = {
  allowRscDocumentFallback?: boolean;
  appRouteMatch?: AppRouteMatch | null;
  isDataRequest?: boolean;
  isRscRequest: boolean;
  matchKind?: "dynamic" | "static";
  middlewareContext: AppMiddlewareContext;
  pathname?: string;
  pagesDataRequest?: Request | null;
  request: Request;
  url: URL;
};
/**
 * Fallback handler to route App Router requests to the Pages Router when no App Router route matches.
 */
declare function renderPagesFallback(options: RenderPagesFallbackOptions, dependencies: RenderPagesFallbackDependencies): Promise<Response | null>;
//#endregion
export { PagesEntry, renderPagesFallback };