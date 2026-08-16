import { hasBasePath, stripBasePath } from "../utils/base-path.js";
import { isAbsoluteOrProtocolRelativeUrl } from "./url-utils.js";
//#region src/shims/link-prefetch.ts
function canLinkPrefetch(input) {
	return input.nodeEnv === "production" && input.prefetch !== false && !input.isDangerous;
}
function canLinkIntentPrefetch(input) {
	if (input.nodeEnv !== "production" || input.isDangerous) return false;
	return input.routerMode === "pages" || input.prefetch !== false;
}
function getLinkPrefetchDecision(input) {
	if (!(input.intent === "intent" ? canLinkIntentPrefetch({
		...input,
		routerMode: input.routerMode ?? "app"
	}) : canLinkPrefetch(input))) return { shouldPrefetch: false };
	return {
		shouldPrefetch: true,
		priority: input.intent === "intent" ? "high" : "low"
	};
}
/**
* Normalize absolute and protocol-relative Link hrefs to app-relative paths
* that are eligible for prefetching. Non-absolute relative hrefs are returned
* unchanged; callers must resolve them against the current browser URL before
* constructing a concrete fetch target.
*/
function getLinkPrefetchHref(input) {
	const { href, basePath, currentOrigin } = input;
	if (!isAbsoluteOrProtocolRelativeUrl(href)) return href;
	if (currentOrigin === void 0) return null;
	try {
		const current = new URL(currentOrigin);
		const parsed = href.startsWith("//") ? new URL(href, current.origin) : new URL(href);
		if (parsed.origin !== current.origin) return null;
		if (!basePath) return parsed.pathname + parsed.search + parsed.hash;
		if (!hasBasePath(parsed.pathname, basePath)) return null;
		return stripBasePath(parsed.pathname, basePath) + parsed.search + parsed.hash;
	} catch {
		return null;
	}
}
//#endregion
export { canLinkIntentPrefetch, canLinkPrefetch, getLinkPrefetchDecision, getLinkPrefetchHref };
