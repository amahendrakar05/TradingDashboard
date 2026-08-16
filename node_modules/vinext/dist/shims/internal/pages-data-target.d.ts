//#region src/shims/internal/pages-data-target.d.ts
type PagesDataTarget = {
  /** Final fetch URL for the data endpoint, including basePath and search. */dataHref: string; /** Locale-qualified data endpoint used by Pages Router prefetch. */
  prefetchDataHref?: string; /** Matched route pattern (e.g. `/blog/[slug]`). */
  pattern: string; /** Dynamic params extracted from the URL by the pattern matcher. */
  params: Record<string, string | string[]>; /** Code-split loader thunk for the matched route's page module. */
  loader: () => Promise<{
    default?: unknown;
    [key: string]: unknown;
  }>; /** Next.js data-fetch mode for this route. Plain pages are component-only. */
  dataKind: "none" | "server" | "static"; /** Middleware-effect data URL to prefetch when the static matcher includes this route. */
  middlewareDataHref?: string; /** Current buildId snapshot, used by the data URL and consistency checks. */
  buildId: string; /** Locale-prefixed (server-routable) page path. */
  pagePath: string; /** URL search string including the leading `?`. */
  search: string; /** Locale selected for middleware-prefetch data URLs when the visible URL is unprefixed. */
  prefetchLocale?: string;
  /**
   * Locale prefix detected on the URL, or `undefined` when the URL is
   * unprefixed (default locale, or no i18n configured). Lets the caller refresh
   * locale state on locale transitions, which the data JSON envelope itself
   * does not carry.
   */
  locale: string | undefined;
};
type PagesDataNavigationTargetOptions = {
  locale?: string | false;
};
declare function getPagesMiddlewareDataHref(browserUrl: string, basePath: string): string | null;
/**
 * Decide whether the JSON data-endpoint navigation path is usable for this
 * browser URL. We require:
 *   - A registered code-split loader for the matched route pattern. Without
 *     this, the client has no chunk URL to import for the new page.
 *   - A buildId on the current `__NEXT_DATA__`, since the data URL embeds it.
 *   - Same-origin (cross-origin URLs do not hit our data endpoint).
 *
 * Locale handling: route patterns in `__VINEXT_PAGE_PATTERNS__` are
 * locale-unaware (`/about`, not `/fr/about`), but the browser URL for a
 * locale-prefixed page is `/fr/about`. We strip the locale prefix before
 * pattern matching so locale transitions hit the JSON fast path. The data URL
 * itself keeps the locale prefix because the server uses it to pick
 * locale-specific gSSP data.
 *
 * Returns the resolved target, or `null` to signal the caller should fall
 * back to the HTML extraction path (dev server, or a route that exists on the
 * server but is not in the client loader map).
 *
 * Ported from Next.js: `packages/next/src/client/page-loader.ts`
 * (`getDataHref`). vinext's equivalent uses an in-memory loader map instead
 * of Next.js' `_buildManifest.js`.
 */
declare function resolvePagesDataNavigationTarget(browserUrl: string, basePath: string, options?: PagesDataNavigationTargetOptions): PagesDataTarget | null;
/**
 * Kick off the code-split loader and, for SSG pages, prefetch the data JSON so
 * the chunk and payload are warm by the time the user clicks.
 *
 * Used by both `Router.prefetch()` and `<Link>` hover/viewport prefetch.
 * Matches Next.js Pages Router prefetch: non-SSG routes only warm the page
 * chunk, while `getStaticProps` routes also fetch `/_next/data`.
 *
 * loader's returned Promise is intentionally discarded — `import()` caches the
 * result, so a subsequent navigation re-invocation hits the cache without
 * paying for a second round trip. Errors are swallowed: prefetch is
 * best-effort and must never break the page.
 */
declare function prefetchPagesData(target: PagesDataTarget): void;
//#endregion
export { PagesDataTarget, getPagesMiddlewareDataHref, prefetchPagesData, resolvePagesDataNavigationTarget };