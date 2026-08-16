//#region src/utils/parse-cookie.d.ts
type ParsedCookies = Record<string, string>;
/**
 * Parse a Cookie header using the semantics of Next.js's compiled `cookie`
 * package.
 */
declare function parseCookieHeader(cookieHeader: string | null | undefined): ParsedCookies;
/**
 * Parse a Cookie header using Next.js/@edge-runtime RequestCookies semantics.
 */
declare function parseEdgeRequestCookieHeader(cookieHeader: string): Map<string, string>;
//#endregion
export { ParsedCookies, parseCookieHeader, parseEdgeRequestCookieHeader };