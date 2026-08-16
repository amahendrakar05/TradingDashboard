//#region src/server/normalize-path.d.ts
declare function escapePathDelimiters(segment: string, escapeEncoded?: boolean): string;
/**
 * Decode a URL pathname segment-by-segment, preserving encoded path delimiters.
 * Non-ASCII characters (e.g. %C3%A9 -> e) are decoded, but structural characters
 * like %2F (/) %23 (#) %3F (?) %5C (\) are re-encoded after decoding.
 *
 * This prevents encoded slashes from changing the path structure (e.g.
 * /admin%2Fpanel stays as a single segment, not /admin/panel).
 *
 * Ported from Next.js: packages/next/src/server/lib/router-utils/decode-path-params.ts
 * https://github.com/vercel/next.js/blob/canary/packages/next/src/server/lib/router-utils/decode-path-params.ts
 */
declare function decodePathParams(pathname: string): string;
declare function isInterceptionMatchedUrlPath(value: string): boolean;
/**
 * Path normalization utility for request handling.
 *
 * Normalizes URL pathnames to a canonical form BEFORE any matching occurs
 * (middleware, routing, redirects, rewrites). This ensures middleware and
 * the router always see the same path, preventing path-confusion issues like
 * double-slash mismatches.
 *
 * Normalization rules:
 *  1. Collapse consecutive slashes: //foo///bar → /foo/bar
 *  2. Resolve single-dot segments:  /foo/./bar  → /foo/bar
 *  3. Resolve double-dot segments:  /foo/../bar → /bar
 *  4. Ensure leading slash:         foo/bar     → /foo/bar
 *  5. Preserve root:                /           → /
 *
 * This function does NOT:
 *  - Strip or add trailing slashes (handled separately by trailingSlash config)
 *  - Decode percent-encoded characters (callers should decode before calling this)
 *  - Lowercase the path (route matching is case-sensitive)
 */
declare function normalizePath(pathname: string): string;
//#endregion
export { decodePathParams, escapePathDelimiters, isInterceptionMatchedUrlPath, normalizePath };