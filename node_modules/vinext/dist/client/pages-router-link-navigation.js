import { stripBasePath } from "../utils/base-path.js";
import { getLocalePathPrefix } from "../utils/domain-locale.js";
//#region src/client/pages-router-link-navigation.ts
function resolvePagesRouterQueryOnlyHref(href, { asPath, basePath, fallbackHref, locales }) {
	if (!href.startsWith("?") && !href.startsWith("#")) return href;
	try {
		const fallbackUrl = new URL(fallbackHref);
		const base = new URL(asPath ?? `${stripBasePath(fallbackUrl.pathname, basePath)}${fallbackUrl.search}${fallbackUrl.hash}`, "http://vinext.local");
		const locale = getLocalePathPrefix(base.pathname, locales);
		if (locale) base.pathname = base.pathname.slice(locale.length + 1) || "/";
		const resolved = new URL(href, base);
		return resolved.href.slice(resolved.origin.length);
	} catch {
		return href;
	}
}
async function navigatePagesRouterLink(router, { href, as, replace, scroll, shallow, locale, interpolateDynamicRoute = false }) {
	const routerOptions = {
		scroll,
		locale
	};
	if (interpolateDynamicRoute) routerOptions._vinextInterpolateDynamicRoute = true;
	if (shallow !== void 0) routerOptions.shallow = shallow;
	if (replace) await router.replace(href, as, routerOptions);
	else await router.push(href, as, routerOptions);
}
async function navigatePagesRouterLinkWithFallback({ router, loadRouter, navigation, fallback }) {
	let pagesRouter = router;
	if (!pagesRouter) try {
		pagesRouter = await loadRouter();
	} catch {
		fallback();
		return;
	}
	if (!pagesRouter) {
		fallback();
		return;
	}
	await navigatePagesRouterLink(pagesRouter, navigation);
}
//#endregion
export { navigatePagesRouterLink, navigatePagesRouterLinkWithFallback, resolvePagesRouterQueryOnlyHref };
