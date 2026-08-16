//#region src/config/request-context.d.ts
/** Request context needed for evaluating has/missing conditions. */
type RequestContext = {
  readonly headers: Headers;
  readonly cookies: Record<string, string>;
  readonly query: URLSearchParams;
  readonly host: string;
};
declare function parseCookies(cookieHeader: string | null): Record<string, string>;
declare function normalizeHost(hostHeader: string | null, fallbackHostname: string): string;
/** Build a lazily parsed request context from a Web Request. */
declare function requestContextFromRequest(request: Request): RequestContext;
//#endregion
export { RequestContext, normalizeHost, parseCookies, requestContextFromRequest };