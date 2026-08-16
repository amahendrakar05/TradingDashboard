//#region src/shims/internal/pages-data-url.d.ts
/**
 * Append `.json` and the `/_next/data/<buildId>` prefix to a page pathname.
 *
 * Mirrors Next.js' `getAssetPathFromRoute` + `getDataHref` behaviour:
 *   `/`            → `/_next/data/<id>/index.json`
 *   `/about`       → `/_next/data/<id>/about.json`
 *   `/index`       → `/_next/data/<id>/index/index.json`  (explicit `/index` page)
 *   `/blog/foo`    → `/_next/data/<id>/blog/foo.json`
 *
 * `pagePath` is the resolved page pathname (already including any locale
 * prefix and dynamic-param substitution), with a leading slash and NO
 * trailing slash. The function does not URL-encode — the caller is expected
 * to have produced a server-routable path.
 */
declare function buildPagesDataPath(buildId: string, pagePath: string): string;
/**
 * Build the full data URL including the basePath, the search string, and the
 * `/_next/data/<buildId>/<page>.json` segment.
 *
 * `pagePath` must already be the resolved pathname (param-substituted,
 * locale-prefixed where applicable). `search` includes the leading `?`.
 */
declare function buildPagesDataHref(basePath: string, buildId: string, pagePath: string, search: string): string;
/** Result of matching a URL pathname against the registered route patterns. */
type PagesPatternMatch = {
  /** The matched route pattern in Next.js bracket format (e.g. `/blog/[slug]`). */pattern: string; /** Dynamic route params extracted from the URL. */
  params: Record<string, string | string[]>;
};
/**
 * Find the route pattern (Next.js bracket format) that matches `pathname`.
 *
 * Patterns are tried in `patterns` order — callers should pre-sort so more
 * specific patterns come before catch-alls. Returns `null` when no pattern
 * matches, so the caller can fall back to a hard navigation (this is how
 * vinext handles routes that exist on the server but are not in the
 * client-side loader map, e.g. dev-only pages).
 */
declare function matchPagesPattern(pathname: string, patterns: readonly string[]): PagesPatternMatch | null;
//#endregion
export { buildPagesDataHref, buildPagesDataPath, matchPagesPattern };