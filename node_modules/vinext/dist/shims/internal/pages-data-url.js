import { matchRoutePattern, routePatternParts } from "../../routing/route-pattern.js";
//#region src/shims/internal/pages-data-url.ts
/**
* Client-side helpers for the Pages Router `/_next/data/<buildId>/<page>.json`
* endpoint.
*
* Ported from Next.js:
*   - `packages/next/src/client/page-loader.ts` (`getDataHref`)
*   - `packages/next/src/shared/lib/router/utils/get-asset-path-from-route.ts`
*
* The server-side counterpart lives in `server/pages-data-route.ts` and parses
* the URL shape this module generates. Keep the two in sync — they are the
* wire-format contract between vinext's client navigation and its data
* endpoint.
*/
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
function buildPagesDataPath(buildId, pagePath) {
	let path = pagePath;
	if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
	let asset;
	if (path === "/") asset = "/index";
	else if (path === "/index" || path.startsWith("/index/")) asset = "/index" + path;
	else asset = path;
	return `/_next/data/${buildId}${asset}.json`;
}
/**
* Build the full data URL including the basePath, the search string, and the
* `/_next/data/<buildId>/<page>.json` segment.
*
* `pagePath` must already be the resolved pathname (param-substituted,
* locale-prefixed where applicable). `search` includes the leading `?`.
*/
function buildPagesDataHref(basePath, buildId, pagePath, search) {
	const dataPath = buildPagesDataPath(buildId, pagePath);
	return `${basePath ? basePath : ""}${dataPath}${search}`;
}
/**
* Find the route pattern (Next.js bracket format) that matches `pathname`.
*
* Patterns are tried in `patterns` order — callers should pre-sort so more
* specific patterns come before catch-alls. Returns `null` when no pattern
* matches, so the caller can fall back to a hard navigation (this is how
* vinext handles routes that exist on the server but are not in the
* client-side loader map, e.g. dev-only pages).
*/
function matchPagesPattern(pathname, patterns) {
	const urlParts = pathname.split("/").filter(Boolean);
	for (const pattern of patterns) {
		const params = matchRoutePattern(urlParts, routePatternParts(pattern));
		if (params !== null) return {
			pattern,
			params
		};
	}
	return null;
}
//#endregion
export { buildPagesDataHref, buildPagesDataPath, matchPagesPattern };
