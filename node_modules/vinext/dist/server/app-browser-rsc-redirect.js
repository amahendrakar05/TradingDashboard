import { isDangerousScheme, reportBlockedDangerousNavigation } from "../shims/url-safety.js";
import { resolveHardNavigationTargetFromRscResponse, stripRscCacheBustingSearchParam, stripRscSuffix } from "./app-rsc-cache-busting.js";
//#region src/server/app-browser-rsc-redirect.ts
const MAX_RSC_REDIRECT_DEPTH = 10;
function blockDangerousStreamedRscRedirect(response, streamedRedirectTarget) {
	if (streamedRedirectTarget === null || !isDangerousScheme(streamedRedirectTarget)) return false;
	response.body?.cancel().catch(() => {});
	reportBlockedDangerousNavigation();
	return true;
}
function toVisibleAppHref(href, origin) {
	const url = new URL(href, origin);
	stripRscCacheBustingSearchParam(url);
	return `${stripRscSuffix(url.pathname)}${url.search}${url.hash}`;
}
function toStreamedRedirectVisibleAppHref(href, origin) {
	const url = new URL(href, origin);
	return `${url.pathname}${url.search}${url.hash}`;
}
function resolveRedirectLifecycleHopFromTarget(options) {
	if (options.targetUrl.origin !== options.origin) return {
		href: options.targetUrl.href,
		kind: "terminal-hard-navigation",
		reason: "externalRedirect",
		redirectDepth: options.redirectDepth
	};
	const redirectedHref = options.redirectedHref;
	if (redirectedHref === toVisibleAppHref(options.currentHref, options.origin)) return {
		href: redirectedHref,
		kind: "no-redirect"
	};
	const maxRedirectDepth = options.maxRedirectDepth ?? MAX_RSC_REDIRECT_DEPTH;
	if (options.redirectDepth >= maxRedirectDepth) return {
		href: redirectedHref,
		kind: "terminal-hard-navigation",
		reason: "maxRedirectsExceeded",
		redirectDepth: options.redirectDepth
	};
	return {
		href: redirectedHref,
		historyUpdateMode: options.historyUpdateMode,
		kind: "follow",
		previousNextUrl: options.requestPreviousNextUrl,
		redirectDepth: options.redirectDepth + 1
	};
}
function resolveRscRedirectLifecycleHop(options) {
	const responseUrl = new URL(options.responseUrl, options.origin);
	return resolveRedirectLifecycleHopFromTarget({
		...options,
		redirectedHref: resolveHardNavigationTargetFromRscResponse(responseUrl.href, options.currentHref, options.origin),
		targetUrl: responseUrl
	});
}
function resolveStreamedRscRedirectLifecycleHop(options) {
	const streamedRedirectUrl = new URL(options.streamedRedirectTarget, options.origin);
	return resolveRedirectLifecycleHopFromTarget({
		...options,
		redirectedHref: toStreamedRedirectVisibleAppHref(options.streamedRedirectTarget, options.origin),
		targetUrl: streamedRedirectUrl
	});
}
//#endregion
export { blockDangerousStreamedRscRedirect, resolveRscRedirectLifecycleHop, resolveStreamedRscRedirectLifecycleHop };
