import { removeTrailingSlash, stripBasePath } from "../../utils/base-path.js";
import { isUnknownRecord } from "../../utils/record.js";
import { getLocalePathPrefix } from "../../utils/domain-locale.js";
import { buildPagesDataHref, matchPagesPattern } from "./pages-data-url.js";
import { NEXT_DEPLOYMENT_ID_HEADER, getDeploymentId } from "../../utils/deployment-id.js";
import { fetchStaticPagesData, fetchUncachedPagesData } from "./pages-data-fetch-dedup.js";
//#region src/shims/internal/pages-data-target.ts
/**
* Shared decision helper for the Pages Router `/_next/data/<id>/<page>.json`
* navigation fast path. Used by both the router shim (for `navigateClient` and
* `Router.prefetch`) and the Link shim (for hover/viewport prefetch).
*
* Lives in `shims/internal/` so neither caller pulls in the router shim at
* module init time — link.tsx and router.ts must remain free of circular
* imports and SSR-side router-init side effects.
*/
function hasVinextMiddleware(nextData) {
	if (!isUnknownRecord(nextData)) return false;
	const vinext = nextData.__vinext;
	return isUnknownRecord(vinext) && vinext.hasMiddleware === true;
}
function isClientMiddlewareMatcherObject(value) {
	if (!isUnknownRecord(value)) return false;
	if (typeof value.source !== "string") return false;
	if (value.locale !== void 0 && value.locale !== false) return false;
	if (value.has !== void 0 && !Array.isArray(value.has)) return false;
	if (value.missing !== void 0 && !Array.isArray(value.missing)) return false;
	return true;
}
function stripLocaleForMiddlewareMatcher(pathname) {
	const locales = window.__VINEXT_LOCALES__;
	if (!locales || locales.length === 0 || pathname === "/") return pathname;
	const firstSegment = pathname.split("/")[1];
	if (!firstSegment || !locales.includes(firstSegment)) return pathname;
	return "/" + pathname.split("/").slice(2).join("/");
}
function clientMiddlewareSourceMatches(pathname, source) {
	if (!/[\\():*+?]/.test(source)) return removeTrailingSlash(pathname) === removeTrailingSlash(source);
	if (source.includes("(") || source.includes("\\")) return true;
	const sourceParts = source.split("/").filter(Boolean);
	const pathParts = pathname.split("/").filter(Boolean);
	let pathIndex = 0;
	for (const sourcePart of sourceParts) {
		if (sourcePart.startsWith(":")) {
			if (sourcePart.endsWith("*")) return true;
			if (sourcePart.endsWith("+")) return pathIndex < pathParts.length;
			if (pathIndex >= pathParts.length) return false;
			pathIndex++;
			continue;
		}
		if (pathParts[pathIndex] !== sourcePart) return false;
		pathIndex++;
	}
	return pathIndex === pathParts.length;
}
function clientMiddlewareMatcherMatches(pathname, matcher) {
	if (matcher === void 0) return true;
	if (typeof matcher === "string") return clientMiddlewareSourceMatches(stripLocaleForMiddlewareMatcher(pathname), matcher);
	if (!Array.isArray(matcher)) return true;
	for (const item of matcher) {
		if (typeof item === "string") {
			if (clientMiddlewareSourceMatches(stripLocaleForMiddlewareMatcher(pathname), item)) return true;
			continue;
		}
		if (!isClientMiddlewareMatcherObject(item)) return true;
		if (clientMiddlewareSourceMatches(item.locale === false ? pathname : stripLocaleForMiddlewareMatcher(pathname), item.source)) return true;
	}
	return false;
}
function getPagesMiddlewareDataHref(browserUrl, basePath) {
	const nextData = window.__NEXT_DATA__;
	if (!nextData || !hasVinextMiddleware(nextData)) return null;
	const buildId = nextData.buildId;
	if (typeof buildId !== "string" || buildId.length === 0) return null;
	let parsed;
	try {
		parsed = new URL(browserUrl, window.location.href);
	} catch {
		return null;
	}
	if (parsed.origin !== window.location.origin) return null;
	const pathname = stripBasePath(parsed.pathname, basePath);
	if (!clientMiddlewareMatcherMatches(pathname, window.__VINEXT_MIDDLEWARE_MATCHER__)) return null;
	return buildPagesDataHref(basePath, buildId, pathname, parsed.search);
}
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
function resolvePagesDataNavigationTarget(browserUrl, basePath, options = {}) {
	if (typeof window === "undefined") return null;
	const loaders = window.__VINEXT_PAGE_LOADERS__;
	const patterns = window.__VINEXT_PAGE_PATTERNS__;
	if (!loaders || !patterns || patterns.length === 0) return null;
	const buildId = window.__NEXT_DATA__?.buildId ?? void 0;
	if (!buildId) return null;
	let parsed;
	try {
		parsed = new URL(browserUrl, window.location.href);
	} catch {
		return null;
	}
	if (parsed.origin !== window.location.origin) return null;
	const pagePath = stripBasePath(parsed.pathname, basePath);
	const locale = getLocalePathPrefix(pagePath, window.__VINEXT_LOCALES__);
	const match = matchPagesPattern(locale ? pagePath.slice(locale.length + 1) || "/" : pagePath, patterns);
	if (!match) return null;
	const loader = loaders[match.pattern];
	if (!loader) return null;
	const ssgPatterns = window.__VINEXT_PAGES_SSG_PATTERNS__;
	const sspPatterns = window.__VINEXT_PAGES_SSP_PATTERNS__;
	const dataKind = ssgPatterns?.includes(match.pattern) ? "static" : sspPatterns?.includes(match.pattern) ? "server" : ssgPatterns === void 0 || sspPatterns === void 0 ? "server" : "none";
	const explicitLocale = options.locale === false ? window.__VINEXT_DEFAULT_LOCALE__ : options.locale;
	const currentLocale = locale ?? explicitLocale ?? window.__VINEXT_LOCALE__;
	const prefetchPagePath = locale || !currentLocale || !window.__VINEXT_LOCALES__?.includes(currentLocale) ? pagePath : `/${currentLocale}${pagePath === "/" ? "" : pagePath}`;
	return {
		dataHref: buildPagesDataHref(basePath, buildId, pagePath, parsed.search),
		prefetchDataHref: buildPagesDataHref(basePath, buildId, prefetchPagePath, parsed.search),
		pattern: match.pattern,
		params: match.params,
		loader,
		dataKind,
		middlewareDataHref: getPagesMiddlewareDataHref(browserUrl, basePath) ?? void 0,
		buildId,
		pagePath,
		search: parsed.search,
		prefetchLocale: currentLocale,
		locale
	};
}
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
function prefetchPagesData(target) {
	if (typeof document === "undefined") return;
	target.loader().catch(() => {});
	if (target.dataKind !== "static" && !target.middlewareDataHref) return;
	const headers = {
		Accept: "application/json",
		purpose: "prefetch",
		"x-nextjs-data": "1"
	};
	if (target.middlewareDataHref) headers["x-middleware-prefetch"] = "1";
	const deploymentId = getDeploymentId();
	if (deploymentId) headers[NEXT_DEPLOYMENT_ID_HEADER] = deploymentId;
	if (target.dataKind === "static") {
		fetchStaticPagesData(target.middlewareDataHref && target.middlewareDataHref !== target.dataHref ? target.middlewareDataHref : target.prefetchDataHref ?? target.middlewareDataHref ?? target.dataHref, { headers }).then((response) => response.arrayBuffer()).catch(() => {});
		return;
	}
	if (target.middlewareDataHref) fetchUncachedPagesData(target.middlewareDataHref, { headers }).catch(() => {});
}
//#endregion
export { getPagesMiddlewareDataHref, prefetchPagesData, resolvePagesDataNavigationTarget };
