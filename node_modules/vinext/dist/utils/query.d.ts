//#region src/utils/query.d.ts
/**
 * Add a query parameter value to an object, promoting to array for duplicate keys.
 * Matches Next.js behavior: ?a=1&a=2 → { a: ['1', '2'] }
 */
type UrlQueryValue = string | number | boolean | null | undefined;
type UrlQuery = Record<string, UrlQueryValue | readonly UrlQueryValue[]>;
declare function addQueryParam(obj: Record<string, string | string[]>, key: string, value: string): void;
/**
 * Merge pathname-derived dynamic route params into a query object.
 *
 * Route params must win over same-name URL search params so `/posts/123?id=456`
 * still exposes `id: "123"` to Pages Router APIs.
 */
declare function mergeRouteParamsIntoQuery(query: Record<string, string | string[]>, params: Record<string, string | string[]>): Record<string, string | string[]>;
/**
 * Parse a URL's query string into a Record, with multi-value keys promoted to arrays.
 *
 * Per RFC 3986 only the first `?` separates path from query; any further `?`
 * characters are part of the query string itself (e.g. `/linker?href=/about?hello=world`
 * has the query `href=/about?hello=world`). Using `indexOf("?")` instead of
 * `split("?")[1]` preserves the rest of the query so values like `<Link href>`
 * targets keep their own query strings intact.
 */
declare function parseQueryString(url: string): Record<string, string | string[]>;
declare function urlQueryToSearchParams(query: UrlQuery): URLSearchParams;
/**
 * Merge the original request URL's query parameters into a rewrite-target URL.
 *
 * Matches Next.js behavior: original query params are preserved on rewrites,
 * but the rewrite-target URL wins on key conflicts. Ported from Next.js
 * `Object.assign(parsedUrl.query, rewrittenParsedUrl.query)` in
 * route-modules/route-module.ts.
 *
 * https://github.com/vercel/next.js/blob/canary/packages/next/src/server/route-modules/route-module.ts
 *
 * The fragment from `rewriteUrl` is preserved (origin/pathname always come
 * from the rewrite target). Absolute rewrite URLs are returned unchanged when
 * the origin differs from the original — external rewrites are proxied
 * elsewhere and shouldn't have local query params smuggled in.
 */
declare function mergeRewriteQuery(originalUrl: string, rewriteUrl: string): string;
/**
 * Append query parameters to a URL while preserving any existing query string
 * and fragment identifier.
 */
declare function appendSearchParamsToUrl(url: string, params: Iterable<[string, string]>): string;
//#endregion
export { UrlQuery, addQueryParam, appendSearchParamsToUrl, mergeRewriteQuery, mergeRouteParamsIntoQuery, parseQueryString, urlQueryToSearchParams };