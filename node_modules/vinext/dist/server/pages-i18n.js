import { detectDomainLocale, normalizeDomainHostname } from "../utils/domain-locale.js";
//#region src/server/pages-i18n.ts
function readHeader(headers, name) {
	if (!headers) return void 0;
	if (headers instanceof Headers) return headers.get(name) ?? void 0;
	const direct = headers[name];
	if (Array.isArray(direct)) return direct.join(", ");
	return direct;
}
const normalizeHostname = normalizeDomainHostname;
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
function normalizeDefaultLocalePathname(pathname, i18n, options = {}) {
	if (!i18n) return pathname;
	if (pathname.startsWith("/_next/") || pathname.startsWith("/__vinext/")) return pathname;
	const parts = pathname.split("/", 3);
	if (parts[1] && i18n.locales.includes(parts[1])) return pathname;
	const defaultLocale = detectDomainLocale(i18n.domains, options.hostname ?? void 0)?.defaultLocale ?? i18n.defaultLocale;
	if (pathname === "/") return `/${defaultLocale}`;
	return `/${defaultLocale}${pathname}`;
}
/**
* Extract locale prefix from a URL path.
* e.g. /fr/about -> { locale: "fr", url: "/about", hadPrefix: true }
*      /about    -> { locale: defaultLocale, url: "/about", hadPrefix: false }
*/
function extractLocaleFromUrl(url, i18nConfig, defaultLocale = i18nConfig.defaultLocale) {
	const parts = url.split("?")[0].split("/").filter(Boolean);
	const query = url.includes("?") ? url.slice(url.indexOf("?")) : "";
	if (parts.length > 0 && i18nConfig.locales.includes(parts[0])) return {
		locale: parts[0],
		url: ("/" + parts.slice(1).join("/") || "/") + query,
		hadPrefix: true
	};
	return {
		locale: defaultLocale,
		url,
		hadPrefix: false
	};
}
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
function stripI18nLocaleForApiRoute(url, i18nConfig) {
	if (!i18nConfig) return url;
	const { url: stripped, hadPrefix } = extractLocaleFromUrl(url, i18nConfig);
	return hadPrefix ? stripped : url;
}
/**
* Detect the preferred locale from the Accept-Language header.
* Returns the best matching locale or null.
*/
function detectLocaleFromAcceptLanguage(acceptLang, i18nConfig) {
	if (!acceptLang) return null;
	const langs = acceptLang.split(",").map((part) => {
		const [lang, qPart] = part.trim().split(";");
		const q = qPart ? parseFloat(qPart.replace("q=", "")) : 1;
		return {
			lang: lang.trim().toLowerCase(),
			q
		};
	}).sort((a, b) => b.q - a.q);
	for (const { lang } of langs) {
		const exactMatch = i18nConfig.locales.find((locale) => locale.toLowerCase() === lang);
		if (exactMatch) return exactMatch;
		const prefix = lang.split("-")[0];
		const prefixMatch = i18nConfig.locales.find((locale) => {
			const lowered = locale.toLowerCase();
			return lowered === prefix || lowered.startsWith(prefix + "-");
		});
		if (prefixMatch) return prefixMatch;
	}
	return null;
}
/**
* Parse the NEXT_LOCALE cookie.
* Returns the cookie value if it matches a configured locale, otherwise null.
*/
function parseCookieLocaleFromHeader(cookieHeader, i18nConfig) {
	if (!cookieHeader) return null;
	const match = cookieHeader.match(/(?:^|;\s*)NEXT_LOCALE=([^;]*)/);
	if (!match) return null;
	let value;
	try {
		value = decodeURIComponent(match[1].trim());
	} catch {
		return null;
	}
	const lowerValue = value.toLowerCase();
	return i18nConfig.locales.find((locale) => locale.toLowerCase() === lowerValue) ?? null;
}
function formatLocalizedRootPath(locale, defaultLocale, basePath = "", trailingSlash = false, search = "") {
	if (locale.toLowerCase() === defaultLocale.toLowerCase()) return void 0;
	return `${`${basePath}/${locale}${trailingSlash ? "/" : ""}`.replace(/\/{2,}/g, "/")}${search}`;
}
function getLocaleRedirect({ headers, nextConfig, pathLocale, urlParsed }) {
	const i18n = nextConfig.i18n;
	if (!i18n || i18n.localeDetection === false || urlParsed.pathname !== "/") return void 0;
	const domainLocale = detectDomainLocale(i18n.domains, urlParsed.hostname ?? void 0);
	const defaultLocale = domainLocale?.defaultLocale || i18n.defaultLocale;
	const preferredLocale = detectLocaleFromAcceptLanguage(readHeader(headers, "accept-language"), i18n) ?? void 0;
	const detectedLocale = pathLocale || domainLocale?.defaultLocale || (parseCookieLocaleFromHeader(readHeader(headers, "cookie"), i18n) ?? void 0) || preferredLocale || i18n.defaultLocale;
	const search = urlParsed.search ?? "";
	const preferredDomain = detectDomainLocale(i18n.domains, void 0, preferredLocale);
	if (domainLocale && preferredDomain) {
		const sameDomain = normalizeHostname(domainLocale.domain) === normalizeHostname(preferredDomain.domain);
		const sameLocale = preferredLocale !== void 0 && preferredDomain.defaultLocale.toLowerCase() === preferredLocale.toLowerCase();
		if (!sameDomain || !sameLocale) {
			const scheme = `http${preferredDomain.http ? "" : "s"}`;
			const localePath = sameLocale || preferredLocale === void 0 ? "" : `/${preferredLocale}`;
			const rootPath = `${nextConfig.basePath ?? ""}${localePath}${nextConfig.trailingSlash ? "/" : ""}` || "/";
			const normalizedPath = rootPath.startsWith("/") ? rootPath : `/${rootPath}`;
			return `${scheme}://${preferredDomain.domain}${normalizedPath}${search}`;
		}
	}
	return formatLocalizedRootPath(detectedLocale, defaultLocale, nextConfig.basePath, nextConfig.trailingSlash, search);
}
function resolvePagesI18nRequest(url, i18nConfig, headers, hostname, basePath = "", trailingSlash = false) {
	const domainLocale = detectDomainLocale(i18nConfig.domains, hostname ?? void 0);
	const localeInfo = extractLocaleFromUrl(url, i18nConfig, domainLocale?.defaultLocale || i18nConfig.defaultLocale);
	let redirectUrl;
	if (!localeInfo.hadPrefix) redirectUrl = getLocaleRedirect({
		headers,
		nextConfig: {
			basePath,
			i18n: i18nConfig,
			trailingSlash
		},
		urlParsed: {
			hostname,
			pathname: localeInfo.url.split("?")[0] || "/",
			search: localeInfo.url.includes("?") ? localeInfo.url.slice(localeInfo.url.indexOf("?")) : ""
		}
	});
	return {
		...localeInfo,
		domainLocale,
		redirectUrl
	};
}
//#endregion
export { detectDomainLocale, detectLocaleFromAcceptLanguage, extractLocaleFromUrl, getLocaleRedirect, normalizeDefaultLocalePathname, parseCookieLocaleFromHeader, resolvePagesI18nRequest, stripI18nLocaleForApiRoute };
