import { cloneRequestWithHeaders, cloneRequestWithUrl } from "./request-pipeline.js";
import { pagesRouteHasPriorityOverAppRoute } from "./hybrid-route-priority.js";
//#region src/server/app-pages-bridge.ts
/**
* Fallback handler to route App Router requests to the Pages Router when no App Router route matches.
*/
async function renderPagesFallback(options, dependencies) {
	const { allowRscDocumentFallback = false, appRouteMatch = null, isDataRequest = false, isRscRequest, matchKind, middlewareContext, pathname = options.url.pathname, pagesDataRequest = null, request, url } = options;
	const { loadPagesEntry, buildRequestHeaders, decodePathParams, applyRouteHandlerMiddlewareContext, getDraftModeCookieHeader } = dependencies;
	if (isRscRequest && !allowRscDocumentFallback) return null;
	const pagesEntry = await loadPagesEntry();
	const pagesRequestHeaders = middlewareContext.requestHeaders ? buildRequestHeaders(request.headers, middlewareContext.requestHeaders) : null;
	let pagesRequest = request;
	if (pagesRequestHeaders) pagesRequest = cloneRequestWithHeaders(request, pagesRequestHeaders);
	const queryIndex = pathname.indexOf("?");
	const pagesPathname = queryIndex === -1 ? pathname : pathname.slice(0, queryIndex);
	const pagesSearch = queryIndex === -1 ? url.search || "" : pathname.slice(queryIndex);
	const pagesUrl = decodePathParams(pagesPathname) + pagesSearch;
	if (pagesPathname.startsWith("/api/") || pagesPathname === "/api") {
		if (typeof pagesEntry.handleApiRoute !== "function") return null;
		const hasApiMatcher = typeof pagesEntry.matchApiRoute === "function";
		const apiMatch = hasApiMatcher ? pagesEntry.matchApiRoute?.(pagesUrl, pagesRequest) ?? null : null;
		if (hasApiMatcher && apiMatch === null) return null;
		if (apiMatch !== null && matchKind === "static" && apiMatch.route.isDynamic) return null;
		if (apiMatch !== null && matchKind === "dynamic" && !apiMatch.route.isDynamic) return null;
		if (appRouteMatch !== null) {
			if (apiMatch === null || !pagesRouteHasPriorityOverAppRoute(apiMatch.route, appRouteMatch.route)) return null;
		}
		const pagesApiResponse = await pagesEntry.handleApiRoute(pagesRequest, pagesUrl);
		const draftCookie = getDraftModeCookieHeader();
		return applyDraftModeCookie(applyRouteHandlerMiddlewareContext(pagesApiResponse, middlewareContext), draftCookie);
	}
	if (typeof pagesEntry.renderPage !== "function") return null;
	const hasPageMatcher = typeof pagesEntry.matchPageRoute === "function";
	const pageMatch = hasPageMatcher ? pagesEntry.matchPageRoute?.(pagesUrl, pagesRequest) ?? null : null;
	if (hasPageMatcher && pageMatch === null) return null;
	if (pageMatch !== null && matchKind === "static" && pageMatch.route.isDynamic) return null;
	if (pageMatch !== null && matchKind === "dynamic" && !pageMatch.route.isDynamic) return null;
	if (appRouteMatch !== null && (pageMatch === null || !pagesRouteHasPriorityOverAppRoute(pageMatch.route, appRouteMatch.route))) return null;
	const renderRequest = pagesDataRequest ? cloneRequestWithUrl(pagesRequest, pagesDataRequest.url) : pagesRequest;
	const pagesRes = isDataRequest ? await pagesEntry.renderPage(renderRequest, pagesUrl, {}, void 0, middlewareContext.requestHeaders, { isDataReq: true }) : await pagesEntry.renderPage(renderRequest, pagesUrl, {}, void 0, middlewareContext.requestHeaders);
	if (pagesRes.status === 404 && pageMatch === null) return null;
	return applyDraftModeCookie(pagesRes, getDraftModeCookieHeader());
}
/**
* Append a middleware-emitted `__prerender_bypass` Set-Cookie header to a Pages
* Router fallback response. Returns the response unchanged when there is no
* draft cookie to add. App Router route handlers/page renders surface this same
* cookie via `finalizeRouteHandlerResponse`/the page response builder; this
* keeps draft-mode parity for requests that fall through to the Pages Router.
*/
function applyDraftModeCookie(response, draftCookie) {
	if (!draftCookie) return response;
	const headers = new Headers(response.headers);
	headers.append("Set-Cookie", draftCookie);
	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers
	});
}
//#endregion
export { renderPagesFallback };
