import { removeTrailingSlash, stripBasePath } from "../../utils/base-path.js";
import { getLocalePathPrefix } from "../../utils/domain-locale.js";
import { getPagesRouterComponentsMap } from "./pages-router-components.js";
//#region src/shims/internal/app-route-detection.ts
/**
* Resolve a prefetch href to a same-origin pathname (basePath-stripped),
* suitable as the key used by Next.js for `router.components[urlPathname]`.
*
* Returns null for external URLs, malformed URLs, or non-browser contexts.
*/
function resolveSameOriginPathname(href, basePath) {
	if (typeof window === "undefined") return null;
	let url;
	try {
		url = new URL(href, window.location.href);
	} catch {
		return null;
	}
	if (url.origin !== window.location.origin) return null;
	const pathname = stripBasePath(url.pathname, basePath);
	const locale = getLocalePathPrefix(pathname, window.__VINEXT_LOCALES__);
	if (!locale) return pathname;
	const localePrefixLength = locale.length + 1;
	return pathname.length === localePrefixLength ? "/" : pathname.slice(localePrefixLength);
}
/**
* Record `components[pathname] = { __appRouter: true }` on the shared
* Pages Router map when the href matches an App Router route. No-op when the
* manifest is absent, the URL is external, or no app route matches.
*
* `pathname` is the basePath-stripped, trailing-slash-stripped path —
* matching Next.js's `removeTrailingSlash(removeBasePath(pathname))` key used
* at read time (router.ts:1442). Stripping here ensures the write and read
* keys agree regardless of whether the caller normalised trailing slashes
* first (e.g. `link.tsx` normalises to match `trailingSlash` config before
* calling, while `router.prefetch()` passes the raw user-supplied URL).
*/
async function markAppRouteDetectedOnPrefetch(href, basePath) {
	if (typeof window === "undefined") return;
	if (!window.__VINEXT_LINK_PREFETCH_ROUTES__?.length) return;
	const { resolveHybridClientRouteOwner } = await import("./hybrid-client-route-owner.js");
	if (resolveHybridClientRouteOwner(href, basePath) !== "app") return;
	const rawPathname = resolveSameOriginPathname(href, basePath);
	if (rawPathname === null) return;
	const pathname = removeTrailingSlash(rawPathname);
	getPagesRouterComponentsMap()[pathname] = { __appRouter: true };
}
//#endregion
export { getPagesRouterComponentsMap, markAppRouteDetectedOnPrefetch };
