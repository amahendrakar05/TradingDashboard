//#region src/server/pages-data-route.d.ts
/**
 * Helpers for the Pages Router `/_next/data/{buildId}/{...page}.json` endpoint.
 *
 * Next.js uses this endpoint for client-side navigations in the Pages Router:
 * `next/link` and `router.push()` fetch `pageProps` from this URL instead of
 * doing a full HTML navigation. The server must:
 *   1. Match the URL pattern and extract the page pathname (with the buildId
 *      and `.json` extension removed, locale prefix preserved).
 *   2. Normalize the URL BEFORE middleware runs so middleware sees the page
 *      path (e.g. `/about`) rather than the raw `/_next/data/.../about.json`.
 *   3. Invoke the same `getServerSideProps` / `getStaticProps` machinery as
 *      the HTML page and serialize the resulting props as a JSON envelope:
 *      `{ pageProps: ... }` with `Content-Type: application/json`.
 *
 * Ported from Next.js:
 *   - `packages/next/src/server/normalizers/request/next-data.ts` — prefix/suffix matcher.
 *   - `packages/next/src/server/base-server.ts` (`handleNextDataRequest`) — pipeline normalization.
 *   - `packages/next/src/server/render.tsx` — JSON envelope emission (`isNextDataRequest`).
 */
type NextDataMatch = {
  /**
   * The normalized page pathname (with leading slash, no trailing slash,
   * `.json` stripped, buildId stripped). For locale-prefixed requests like
   * `/_next/data/<buildId>/en/about.json` this is `/en/about` — locale
   * handling is done downstream by the existing `resolvePagesI18nRequest`
   * pipeline so this helper does not need to know about i18n config.
   */
  pagePathname: string;
};
/**
 * Returns true if the pathname looks like a `_next/data` request, regardless
 * of buildId. Used by the request pipeline to short-circuit before middleware
 * even when the buildId is wrong (so we can still return a 404 JSON response).
 */
declare function isNextDataPathname(pathname: string): boolean;
/**
 * WHATWG URL parsing removes TAB, LF, and CR characters. Reject paths where
 * that normalization would manufacture the internal Pages data namespace.
 */
declare function urlParserCreatesPagesDataPath(pathname: string): boolean;
/**
 * Keep URL-parser-ignored characters encoded until route matching decodes the
 * captured parameter. Passing them literally to `new URL()` would remove them.
 */
declare function encodeUrlParserIgnoredCharacters(pathname: string): string;
/**
 * Parse `/_next/data/<buildId>/<...page>.json` and return the normalized page
 * pathname. Returns `null` if the pathname does not match the pattern or if
 * the buildId segment does not match the server's buildId.
 *
 * The returned `pagePathname` is the page route path Next.js would render for
 * the equivalent HTML navigation — including any locale prefix, which is then
 * stripped by `resolvePagesI18nRequest` downstream.
 *
 * `/_next/data/<buildId>/about.json`         → `/about`
 * `/_next/data/<buildId>/en/about.json`      → `/en/about`
 * `/_next/data/<buildId>/index.json`         → `/`
 * `/_next/data/<buildId>/en.json`            → `/en`
 * `/_next/data/<wrong-id>/about.json`        → null
 * `/_next/data/<buildId>/about`              → null  (missing .json suffix)
 */
declare function parseNextDataPathname(pathname: string, buildId: string): NextDataMatch | null;
declare function normalizeNextDataPagePathname(pagePathname: string, trailingSlash?: boolean): string;
/**
 * Build the JSON envelope returned by `/_next/data/<buildId>/<page>.json`.
 * Mirrors Next.js' `RenderResult(JSON.stringify(props))` path in
 * `packages/next/src/server/render.tsx` (search for `isNextDataRequest`).
 *
 * The envelope is the outer `props` object the React tree would receive:
 *   { pageProps: {...}, /* optional locale data, redirect markers, etc. *\/ }
 */
declare function buildNextDataJsonResponse(pageProps: Record<string, unknown>, safeJsonStringify: (value: unknown) => string, init?: ResponseInit): Response;
/**
 * Build a `_next/data` JSON response from the full Pages props object returned
 * through `_app.getInitialProps`. Next.js serializes the same outer props
 * object that would be passed to `<App />`, so custom app-level props remain
 * siblings of `pageProps` in the data envelope.
 */
declare function buildNextDataPropsJsonResponse(props: Record<string, unknown>, safeJsonStringify: (value: unknown) => string, init?: ResponseInit): Response;
/**
 * Build the 404 response Next.js returns for an unknown `_next/data` page.
 * Next.js renders this as a normal 404 page, but the body shape that clients
 * see for a missing page-data endpoint is the literal string `"{ }"` for the
 * body and a 404 status with `application/json` so client-side hard-navigation
 * fallback fires (see `__N_SSP` handling in `router.ts`).
 *
 * We match Next.js' behavior: 404 status + JSON content type. The body is an
 * empty JSON object so clients that blindly call `res.json()` do not throw
 * before checking the status code.
 */
declare function buildNextDataNotFoundResponse(): Response;
declare function buildMiddlewarePrefetchSkipResponse(matchedPathname: string): Response;
type NormalizePagesDataRequestResult = {
  isDataReq: false;
  request: Request;
  normalizedPathname: null;
  search: "";
  notFoundResponse: null;
} | {
  isDataReq: false;
  request: Request;
  normalizedPathname: null;
  search: "";
  notFoundResponse: Response;
} | {
  isDataReq: true;
  request: Request;
  normalizedPathname: string;
  search: string;
  notFoundResponse: null;
};
/**
 * Detect and normalize `/_next/data/<buildId>/<page>.json` requests in one
 * place so the Pages Router pipeline and middleware shim do not need to know
 * about the data-endpoint protocol.
 *
 * Returns:
 * - `isDataReq: false, notFoundResponse: null` — not a data request.
 * - `isDataReq: false, notFoundResponse: Response` — looks like a data URL but
 *   the buildId does not match; callers should return `notFoundResponse`
 *   immediately so stale clients fall back to a hard navigation.
 * - `isDataReq: true` — valid data request; `request` is re-pointed at the
 *   normalized page path, `normalizedPathname` carries the bare page path, and
 *   `search` carries the original query string for callers that need to
 *   preserve it.
 *
 * Extracted from `entries/pages-server-entry.ts` so both `renderPage` and
 * `runMiddleware` share a single implementation.
 */
declare function normalizePagesDataRequest(request: Request, buildId: string | null, basePath?: string, trailingSlash?: boolean): NormalizePagesDataRequestResult;
//#endregion
export { buildMiddlewarePrefetchSkipResponse, buildNextDataJsonResponse, buildNextDataNotFoundResponse, buildNextDataPropsJsonResponse, encodeUrlParserIgnoredCharacters, isNextDataPathname, normalizeNextDataPagePathname, normalizePagesDataRequest, parseNextDataPathname, urlParserCreatesPagesDataPath };