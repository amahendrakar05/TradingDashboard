//#region src/server/middleware-response-headers.d.ts
declare function mergeVaryHeader(target: Headers, value: string): void;
/**
 * Merge middleware response headers into a target Headers object.
 *
 * Set-Cookie and Vary are accumulated (append) since multiple sources can
 * contribute values. All other headers use set() so middleware owns singular
 * response headers like Cache-Control.
 */
declare function mergeMiddlewareResponseHeaders(target: Headers, middlewareHeaders: Headers | null): void;
//#endregion
export { mergeMiddlewareResponseHeaders, mergeVaryHeader };