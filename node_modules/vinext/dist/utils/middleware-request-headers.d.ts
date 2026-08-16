//#region src/utils/middleware-request-headers.d.ts
type MiddlewareHeaderValue = string | string[];
type MiddlewareHeaderSource = Headers | Record<string, MiddlewareHeaderValue>;
type BuildRequestHeadersOptions = {
  preserveCredentialHeaders?: boolean;
};
declare function encodeMiddlewareRequestHeaders(targetHeaders: Headers, requestHeaders: Headers): void;
declare function buildRequestHeadersFromMiddlewareResponse(baseHeaders: Headers, middlewareHeaders: MiddlewareHeaderSource, options?: BuildRequestHeadersOptions): Headers | null;
declare function shouldKeepMiddlewareHeader(key: string): boolean;
//#endregion
export { buildRequestHeadersFromMiddlewareResponse, encodeMiddlewareRequestHeaders, shouldKeepMiddlewareHeader };