import { NextI18nConfig } from "../config/next-config.js";
import { DomainLocale, detectDomainLocale } from "../utils/domain-locale.js";

//#region src/server/pages-i18n.d.ts
type HeaderValue = string | string[] | undefined;
type HeaderBag = Headers | Record<string, HeaderValue> | undefined;
type LocaleRedirectOptions = {
  headers?: HeaderBag;
  nextConfig: {
    basePath?: string;
    i18n?: NextI18nConfig | null;
    trailingSlash?: boolean;
  };
  pathLocale?: string;
  urlParsed: {
    hostname?: string | null;
    pathname: string;
    search?: string;
  };
};
type PagesI18nRequestInfo = {
  locale: string;
  url: string;
  hadPrefix: boolean;
  domainLocale?: DomainLocale;
  redirectUrl?: string;
};
/**
 * Prepend the default locale prefix to a pathname when i18n is configured and
 * the path does not already carry a locale prefix. Mirrors Next.js's
 * server-side path normalisation in `resolve-routes.ts` (lines ~250-263):
 *
 *   if (!initialLocaleResult.detectedLocale && !pathname.startsWith('/_next/')) {
 *     parsedUrl.pathname = `/${defaultLocale}${pathname === '/' ? '' : pathname}`
 *   }
 *
 * Run this **before** matching against `next.config.js` redirects/rewrites
 * (which are emitted by `applyLocaleToRoutes` in locale-prefixed forms) so
 * that requests arriving without a locale prefix still match those rules.
 *
 * Skips internal paths that Next.js leaves alone:
 *   - `/_next/*` (build assets, prerender manifests, image optimisation)
 *   - `/__vinext/*` (vinext-internal endpoints)
 *
 * Returns the input unchanged when i18n is not configured or when the path
 * already starts with one of the configured locales. The host-based default
 * locale (i18n.domains[].defaultLocale) is preferred over the global default
 * when supplied, matching Next.js's `domainLocale.defaultLocale` branch.
 *
 * Item 4 of issue #1336: without this normalisation, requests like
 * `/to-sv` (default locale = en) against a rule `source: '/:locale/to-sv'`
 * with `locale: false` do not match because there is no segment for
 * `:locale`. After normalisation the request looks like `/en/to-sv` and
 * the rule matches with `:locale=en`.
 *
 * Ported from Next.js: packages/next/src/server/lib/router-utils/resolve-routes.ts
 * https://github.com/vercel/next.js/blob/canary/packages/next/src/server/lib/router-utils/resolve-routes.ts
 */
declare function normalizeDefaultLocalePathname(pathname: string, i18n: NextI18nConfig | null | undefined, options?: {
  hostname?: string | null;
}): string;
/**
 * Extract locale prefix from a URL path.
 * e.g. /fr/about -> { locale: "fr", url: "/about", hadPrefix: true }
 *      /about    -> { locale: defaultLocale, url: "/about", hadPrefix: false }
 */
declare function extractLocaleFromUrl(url: string, i18nConfig: NextI18nConfig, defaultLocale?: string): {
  locale: string;
  url: string;
  hadPrefix: boolean;
};
/**
 * Strip a leading i18n locale segment from a URL so the result can be used for
 * API route matching. Mirrors Next.js's base-server behaviour for Pages
 * Router API routes: `normalizeLocalePath(pathname, i18n.locales).pathname`
 * runs before the `/api/*` check so `/fr/api/ok` resolves to the
 * `pages/api/ok` handler instead of 404'ing.
 *
 * Returns the original URL untouched when:
 * - `i18nConfig` is null/undefined (no i18n configured)
 * - the URL does not start with a configured locale
 *
 * The query string is preserved verbatim — only the path segment is stripped.
 *
 * Reference: packages/next/src/shared/lib/i18n/normalize-locale-path.ts.
 */
declare function stripI18nLocaleForApiRoute(url: string, i18nConfig: NextI18nConfig | null | undefined): string;
/**
 * Detect the preferred locale from the Accept-Language header.
 * Returns the best matching locale or null.
 */
declare function detectLocaleFromAcceptLanguage(acceptLang: string | null | undefined, i18nConfig: NextI18nConfig): string | null;
/**
 * Parse the NEXT_LOCALE cookie.
 * Returns the cookie value if it matches a configured locale, otherwise null.
 */
declare function parseCookieLocaleFromHeader(cookieHeader: string | null | undefined, i18nConfig: NextI18nConfig): string | null;
declare function getLocaleRedirect({
  headers,
  nextConfig,
  pathLocale,
  urlParsed
}: LocaleRedirectOptions): string | undefined;
declare function resolvePagesI18nRequest(url: string, i18nConfig: NextI18nConfig, headers?: HeaderBag, hostname?: string | null, basePath?: string, trailingSlash?: boolean): PagesI18nRequestInfo;
//#endregion
export { detectDomainLocale, detectLocaleFromAcceptLanguage, extractLocaleFromUrl, getLocaleRedirect, normalizeDefaultLocalePathname, parseCookieLocaleFromHeader, resolvePagesI18nRequest, stripI18nLocaleForApiRoute };