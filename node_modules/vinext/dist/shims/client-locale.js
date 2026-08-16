import { stripBasePath } from "../utils/base-path.js";
import { detectDomainLocale, getLocalePathPrefix } from "../utils/domain-locale.js";
//#region src/shims/client-locale.ts
function getCurrentBrowserLocale({ basePath, domainLocales, hostname }) {
	if (typeof window === "undefined") return void 0;
	const pathnameLocale = getLocalePathPrefix(stripBasePath(window.location.pathname, basePath), window.__VINEXT_LOCALES__);
	if (pathnameLocale) return pathnameLocale;
	return detectDomainLocale(domainLocales, hostname ?? void 0)?.defaultLocale ?? window.__VINEXT_LOCALE__ ?? window.__VINEXT_DEFAULT_LOCALE__;
}
//#endregion
export { getCurrentBrowserLocale };
