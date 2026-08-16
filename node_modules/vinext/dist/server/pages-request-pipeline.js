import { addBasePathToPathname, hasBasePath } from "../utils/base-path.js";
import { patternToNextFormat } from "../routing/route-validation.js";
import { requestContextFromRequest } from "../config/request-context.js";
import { isExternalUrl } from "../utils/external-url.js";
import { applyMiddlewareRequestHeaders, matchRedirect, matchRewrite, preserveRedirectDestinationQuery, proxyExternalRequest, sanitizeDestination } from "../config/config-matchers.js";
import { cloneRequestWithUrl, normalizeTrailingSlash } from "./request-pipeline.js";
import { mergeRewriteQuery } from "../utils/query.js";
import { normalizeDefaultLocalePathname, stripI18nLocaleForApiRoute } from "./pages-i18n.js";
import { buildMiddlewarePrefetchSkipResponse } from "./pages-data-route.js";
import { applyConfigHeadersToHeaderRecord } from "./config-headers.js";
import { mergeHeaders } from "./worker-utils.js";
//#region src/server/pages-request-pipeline.ts
async function fetchWorkerFilesystemRoute(request, requestPathname, phase, fetchAsset) {
	if (phase === "direct" || request.method !== "GET" && request.method !== "HEAD" || requestPathname === "/api" || requestPathname.startsWith("/api/")) return false;
	const assetUrl = new URL(request.url);
	assetUrl.pathname = requestPathname;
	assetUrl.search = "";
	const response = await fetchAsset(new Request(assetUrl, request));
	return response.status === 404 ? false : response;
}
/**
* Wrap an adapter's `runMiddleware` callback so middleware receives the original
* (pre-basePath-stripping) URL. Adapters strip the basePath before handing the
* request to `runPagesRequest`, but Next.js passes the un-stripped URL to the
* middleware adapter so `request.nextUrl.basePath` reflects whether the URL
* actually had the basePath prefix. Requests outside the basePath
* (`hadBasePath === false`) are passed through untouched so middleware sees
* `nextUrl.basePath === ""` and can redirect them into the basePath
* (see the middleware-base-path e2e test / #1830).
*
* Shared by the Node prod server (prod-server.ts) and the generated Pages
* Router worker entry (deploy.ts) to keep the two adapters in sync.
*/
function wrapMiddlewareWithBasePath(runMiddleware, basePath, hadBasePath) {
	if (!hadBasePath || !basePath) return runMiddleware;
	return (request, ctx, opts) => {
		const mwUrl = new URL(request.url);
		mwUrl.pathname = addBasePathToPathname(mwUrl.pathname, basePath);
		return runMiddleware(new Request(mwUrl, request), ctx, opts);
	};
}
/**
* Run the Pages Router request pipeline.
*
* ASSUMPTION: request already has internal headers filtered and basePath stripped.
* The adapter is responsible for that pre-processing before calling runPagesRequest.
* The adapter also handles: open-redirect guard, _next/static 404, image optimization,
* _next/data normalization and classification: adapters must rewrite the data
* URL to its page pathname and set `isDataReq` (the source of truth here), Node
* decode/normalize/400, public-file serving.
* runPagesRequest receives a "clean" request with basePath-stripped URL.
*/
async function runPagesRequest(request, deps) {
	const { basePath, trailingSlash, i18nConfig, configRedirects, configRewrites, configHeaders, hadBasePath, isDataReq, isDataRequest } = deps;
	const proxyExternal = (currentReq, externalUrl) => deps.proxyExternal ? deps.proxyExternal(currentReq, externalUrl) : proxyExternalRequest(currentReq, externalUrl);
	const url = new URL(request.url);
	let pathname = url.pathname;
	const search = url.search;
	const requestConfigPathname = deps.configMatchPathname ?? pathname;
	const basePathState = {
		basePath,
		hadBasePath
	};
	{
		const trailingSlashRedirect = isDataReq ? null : normalizeTrailingSlash(pathname, basePath, trailingSlash, search);
		if (trailingSlashRedirect) return {
			type: "response",
			response: trailingSlashRedirect
		};
	}
	const reqCtx = requestContextFromRequest(request);
	const requestHostname = i18nConfig ? url.hostname : "";
	const requestConfigMatchPathname = i18nConfig ? normalizeDefaultLocalePathname(requestConfigPathname, i18nConfig, { hostname: requestHostname }) : requestConfigPathname;
	if (configRedirects.length) {
		const redirect = matchRedirect(requestConfigMatchPathname, configRedirects, reqCtx, basePathState);
		if (redirect) {
			const location = preserveRedirectDestinationQuery(sanitizeDestination(basePath && hadBasePath && !isExternalUrl(redirect.destination) && !hasBasePath(redirect.destination, basePath) ? basePath + redirect.destination : redirect.destination), deps.rawSearch ?? search);
			return {
				type: "response",
				response: new Response(null, {
					status: redirect.permanent ? 308 : 307,
					headers: { Location: location }
				})
			};
		}
	}
	const originalResolvedUrl = pathname + search;
	let resolvedUrl = originalResolvedUrl;
	let resolvedPathnameIsRequestPathname = true;
	const middlewareHeaders = {};
	let middlewareStatus;
	const serveFilesystemRoute = async (requestPathname, phase) => {
		if (!deps.serveFilesystemRoute) return null;
		const served = await deps.serveFilesystemRoute(requestPathname, middlewareHeaders, phase);
		if (served instanceof Response) return {
			type: "response",
			response: mergeHeaders(served, middlewareHeaders, middlewareStatus)
		};
		return served ? { type: "handled" } : null;
	};
	if (typeof deps.runMiddleware === "function") {
		const result = await deps.runMiddleware(request, deps.ctx ?? null, { isDataRequest });
		if (result.waitUntilPromises && result.waitUntilPromises.length > 0) {
			const ctx = deps.ctx;
			if (ctx && typeof ctx.waitUntil === "function") for (const p of result.waitUntilPromises) ctx.waitUntil(p);
			else Promise.allSettled(result.waitUntilPromises);
		}
		if (!result.continue) {
			if (result.redirectUrl) {
				const redirectHeaders = { Location: result.redirectUrl };
				if (result.responseHeaders) for (const [key, value] of result.responseHeaders) {
					const existing = redirectHeaders[key];
					if (existing === void 0) redirectHeaders[key] = value;
					else if (Array.isArray(existing)) existing.push(value);
					else redirectHeaders[key] = [existing, value];
				}
				const headers = new Headers();
				for (const [k, v] of Object.entries(redirectHeaders)) if (Array.isArray(v)) for (const item of v) headers.append(k, item);
				else headers.set(k, v);
				return {
					type: "response",
					response: new Response(null, {
						status: result.redirectStatus ?? 307,
						headers
					})
				};
			}
			if (result.response) return {
				type: "response",
				response: result.response
			};
		}
		if (result.responseHeaders) for (const [key, value] of result.responseHeaders) if (key === "set-cookie") {
			const existing = middlewareHeaders[key];
			if (Array.isArray(existing)) existing.push(value);
			else if (existing) middlewareHeaders[key] = [existing, value];
			else middlewareHeaders[key] = [value];
		} else middlewareHeaders[key] = value;
		if (result.rewriteUrl) {
			resolvedUrl = result.rewriteUrl;
			resolvedPathnameIsRequestPathname = false;
		}
		middlewareStatus = result.status ?? result.rewriteStatus;
	}
	const { postMwReqCtx, request: postMwReq } = applyMiddlewareRequestHeaders(middlewareHeaders, request, { preserveCredentialHeaders: isExternalUrl(resolvedUrl) });
	request = postMwReq;
	const pathnameForResolvedUrl = (value) => value.split("#", 1)[0].split("?", 1)[0];
	const rewriteRequestContext = () => ({
		...postMwReqCtx,
		query: new URL(resolvedUrl, url).searchParams
	});
	let resolvedPathname = pathnameForResolvedUrl(resolvedUrl);
	const matchResolvedPathname = (p) => i18nConfig ? normalizeDefaultLocalePathname(p, i18nConfig, { hostname: requestHostname }) : p;
	const configSourcePathname = () => resolvedPathnameIsRequestPathname ? requestConfigMatchPathname : matchResolvedPathname(resolvedPathname);
	const matchedPathnameForRoute = (routePattern) => {
		const matchedPathname = routePattern ? patternToNextFormat(routePattern) : resolvedPathname;
		if (!i18nConfig) return matchedPathname;
		const resolvedLocale = resolvedPathname.split("/", 3)[1];
		if (resolvedLocale && i18nConfig.locales.includes(resolvedLocale)) return matchedPathname === "/" ? `/${resolvedLocale}` : `/${resolvedLocale}${matchedPathname}`;
		return matchResolvedPathname(matchedPathname);
	};
	const buildMiddlewarePrefetchSkipResult = (match) => {
		if (!match) return null;
		if (match.route.dataKind !== "server" || !isDataRequest || !deps.hasMiddleware || request.headers.get("x-middleware-prefetch") !== "1") return null;
		return {
			type: "response",
			response: mergeHeaders(buildMiddlewarePrefetchSkipResponse(matchedPathnameForRoute(match.route.pattern)), middlewareHeaders, void 0),
			defaultContentType: "application/json"
		};
	};
	if (configHeaders.length) applyConfigHeadersToHeaderRecord(middlewareHeaders, {
		configHeaders,
		pathname: requestConfigMatchPathname,
		requestContext: reqCtx,
		basePathState
	});
	if (isExternalUrl(resolvedUrl)) return {
		type: "response",
		response: mergeHeaders(await proxyExternal(request, resolvedUrl), middlewareHeaders, void 0)
	};
	const directFilesystemResult = await serveFilesystemRoute(pathname, "direct");
	if (directFilesystemResult) return directFilesystemResult;
	let configRewriteFired = false;
	for (const rewrite of configRewrites.beforeFiles ?? []) {
		const rewritten = matchRewrite(configSourcePathname(), [rewrite], rewriteRequestContext(), basePathState);
		if (rewritten) {
			if (isExternalUrl(rewritten)) return {
				type: "response",
				response: await proxyExternal(request, rewritten)
			};
			resolvedUrl = mergeRewriteQuery(resolvedUrl, rewritten);
			resolvedPathname = pathnameForResolvedUrl(resolvedUrl);
			resolvedPathnameIsRequestPathname = false;
			configRewriteFired = true;
		}
	}
	if (configRewriteFired) {
		const beforeFilesResult = await serveFilesystemRoute(resolvedPathname, "beforeFiles");
		if (beforeFilesResult) return beforeFilesResult;
	}
	const isOutsideBasePathUnclaimed = () => basePath && !hadBasePath && !configRewriteFired;
	const outOfBasePathNotFound = () => ({
		type: "response",
		response: new Response("This page could not be found", {
			status: 404,
			headers: { "Content-Type": "text/html; charset=utf-8" }
		})
	});
	const handleResolvedApiRoute = async () => {
		if (isOutsideBasePathUnclaimed()) return null;
		const apiLookupUrl = stripI18nLocaleForApiRoute(resolvedUrl, i18nConfig);
		const apiLookupPathname = apiLookupUrl.split("?")[0];
		if (!apiLookupPathname.startsWith("/api/") && apiLookupPathname !== "/api") return null;
		if (typeof deps.handleApi === "function") {
			let apiRequest = request;
			if (basePath && hadBasePath) {
				const apiRequestUrl = new URL(request.url);
				apiRequestUrl.pathname = addBasePathToPathname(apiRequestUrl.pathname, basePath);
				apiRequest = cloneRequestWithUrl(request, apiRequestUrl.toString());
			}
			return {
				type: "response",
				defaultContentType: "application/octet-stream",
				response: mergeHeaders(await deps.handleApi(apiRequest, apiLookupUrl, deps.ctx ?? null), middlewareHeaders, middlewareStatus)
			};
		}
		return {
			type: "api",
			apiUrl: apiLookupUrl,
			stagedHeaders: middlewareHeaders,
			requestHeaders: request.headers,
			middlewareStatus
		};
	};
	const apiResult = await handleResolvedApiRoute();
	if (apiResult) return apiResult;
	let pageMatch = !isOutsideBasePathUnclaimed() && deps.matchPageRoute ? deps.matchPageRoute(resolvedPathname, request) : null;
	let resolvedPathnameChanged = false;
	if (!pageMatch || pageMatch.route.isDynamic) for (const rewrite of configRewrites.afterFiles ?? []) {
		const rewritten = matchRewrite(configSourcePathname(), [rewrite], rewriteRequestContext(), basePathState);
		if (rewritten) {
			if (isExternalUrl(rewritten)) return {
				type: "response",
				response: await proxyExternal(request, rewritten)
			};
			resolvedUrl = mergeRewriteQuery(resolvedUrl, rewritten);
			resolvedPathname = pathnameForResolvedUrl(resolvedUrl);
			resolvedPathnameIsRequestPathname = false;
			configRewriteFired = true;
			resolvedPathnameChanged = true;
			const afterFilesFilesystemResult = await serveFilesystemRoute(resolvedPathname, "afterFiles");
			if (afterFilesFilesystemResult) return afterFilesFilesystemResult;
			const afterFilesApiResult = await handleResolvedApiRoute();
			if (afterFilesApiResult) return afterFilesApiResult;
			pageMatch = deps.matchPageRoute ? deps.matchPageRoute(resolvedPathname, request) : null;
			if (pageMatch) break;
		}
	}
	const refreshDataRewriteHeader = () => {
		if ((isDataReq || isDataRequest) && resolvedUrl !== originalResolvedUrl && !isExternalUrl(resolvedUrl)) middlewareHeaders["x-nextjs-rewrite"] = resolvedUrl;
		else delete middlewareHeaders["x-nextjs-rewrite"];
	};
	refreshDataRewriteHeader();
	if (typeof deps.renderPage === "function") {
		let renderPageMatch = pageMatch;
		if ((isOutsideBasePathUnclaimed() || isDataReq || isDataRequest) && !renderPageMatch && configRewrites.fallback?.length) for (const rewrite of configRewrites.fallback) {
			const fallbackRewrite = matchRewrite(configSourcePathname(), [rewrite], rewriteRequestContext(), basePathState);
			if (!fallbackRewrite) continue;
			if (isExternalUrl(fallbackRewrite)) return {
				type: "response",
				response: await proxyExternal(request, fallbackRewrite)
			};
			resolvedUrl = mergeRewriteQuery(resolvedUrl, fallbackRewrite);
			resolvedPathname = pathnameForResolvedUrl(resolvedUrl);
			resolvedPathnameIsRequestPathname = false;
			configRewriteFired = true;
			const fallbackFilesystemResult = await serveFilesystemRoute(resolvedPathname, "fallback");
			if (fallbackFilesystemResult) return fallbackFilesystemResult;
			const fallbackApiResult = await handleResolvedApiRoute();
			if (fallbackApiResult) return fallbackApiResult;
			renderPageMatch = deps.matchPageRoute ? deps.matchPageRoute(resolvedPathname, request) : null;
			refreshDataRewriteHeader();
			if (renderPageMatch) break;
		}
		const prefetchSkipResult = buildMiddlewarePrefetchSkipResult(renderPageMatch);
		if (prefetchSkipResult) return prefetchSkipResult;
		if (isOutsideBasePathUnclaimed()) return outOfBasePathNotFound();
		const shouldDeferErrorPageOnMiss = !isDataReq && !isDataRequest && !!deps.matchPageRoute && !renderPageMatch;
		const initialRenderOptions = shouldDeferErrorPageOnMiss ? { renderErrorPageOnMiss: false } : isDataReq ? { isDataReq: true } : void 0;
		const stagedHeaders = new Headers();
		for (const [k, v] of Object.entries(middlewareHeaders)) if (Array.isArray(v)) for (const item of v) stagedHeaders.append(k, item);
		else stagedHeaders.set(k, v);
		let response = await deps.renderPage(request, resolvedUrl, initialRenderOptions, stagedHeaders);
		let matchedFallbackRewrite = false;
		if (response.status === 404 && shouldDeferErrorPageOnMiss && configRewrites.fallback?.length) for (const rewrite of configRewrites.fallback) {
			const fallbackRewrite = matchRewrite(configSourcePathname(), [rewrite], rewriteRequestContext(), basePathState);
			if (!fallbackRewrite) continue;
			if (isExternalUrl(fallbackRewrite)) return {
				type: "response",
				response: await proxyExternal(request, fallbackRewrite)
			};
			resolvedUrl = mergeRewriteQuery(resolvedUrl, fallbackRewrite);
			resolvedPathname = pathnameForResolvedUrl(resolvedUrl);
			resolvedPathnameIsRequestPathname = false;
			configRewriteFired = true;
			const fallbackFilesystemResult = await serveFilesystemRoute(resolvedPathname, "fallback");
			if (fallbackFilesystemResult) return fallbackFilesystemResult;
			const fallbackApiResult = await handleResolvedApiRoute();
			if (fallbackApiResult) return fallbackApiResult;
			renderPageMatch = deps.matchPageRoute ? deps.matchPageRoute(resolvedPathname, request) : null;
			response = await deps.renderPage(request, resolvedUrl, void 0, stagedHeaders);
			matchedFallbackRewrite = true;
			if (response.status !== 404) break;
		}
		if (response.status === 404 && shouldDeferErrorPageOnMiss && !matchedFallbackRewrite) response = await deps.renderPage(request, resolvedUrl, void 0, stagedHeaders);
		const matchedPathHeaders = { ...middlewareHeaders };
		if ((isDataReq || isDataRequest) && deps.hasMiddleware && !renderPageMatch && response.status === 404 && (middlewareStatus === void 0 || middlewareStatus === 200 || middlewareStatus === 404)) {
			const headers = new Headers(response.headers);
			headers.set("content-type", "application/json");
			headers.set("x-nextjs-matched-path", matchResolvedPathname(pathname));
			return {
				type: "response",
				response: mergeHeaders(new Response("{}", {
					status: 200,
					headers
				}), matchedPathHeaders, void 0),
				defaultContentType: "application/json"
			};
		}
		if ((isDataReq || isDataRequest) && renderPageMatch && (middlewareStatus ?? response.status) === 200) matchedPathHeaders["x-nextjs-matched-path"] = matchedPathnameForRoute(renderPageMatch?.route.pattern);
		const merged = mergeHeaders(response, matchedPathHeaders, middlewareStatus);
		if (merged !== response) merged.__vinextStreamedHtmlResponse = response.__vinextStreamedHtmlResponse;
		return {
			type: "response",
			response: merged,
			defaultContentType: "text/html; charset=utf-8"
		};
	}
	let devPageMatch = isOutsideBasePathUnclaimed() ? null : resolvedPathnameChanged ? deps.matchPageRoute ? deps.matchPageRoute(resolvedPathname, request) : null : pageMatch;
	if (!devPageMatch && configRewrites.fallback?.length) for (const rewrite of configRewrites.fallback) {
		const fallbackRewrite = matchRewrite(configSourcePathname(), [rewrite], rewriteRequestContext(), basePathState);
		if (!fallbackRewrite) continue;
		if (isExternalUrl(fallbackRewrite)) return {
			type: "response",
			response: await proxyExternal(request, fallbackRewrite)
		};
		resolvedUrl = mergeRewriteQuery(resolvedUrl, fallbackRewrite);
		resolvedPathname = pathnameForResolvedUrl(resolvedUrl);
		resolvedPathnameIsRequestPathname = false;
		configRewriteFired = true;
		const fallbackFilesystemResult = await serveFilesystemRoute(resolvedPathname, "fallback");
		if (fallbackFilesystemResult) return fallbackFilesystemResult;
		const fallbackApiResult = await handleResolvedApiRoute();
		if (fallbackApiResult) return fallbackApiResult;
		devPageMatch = deps.matchPageRoute?.(resolvedPathname, request) ?? null;
		if (devPageMatch) break;
	}
	const prefetchSkipResult = buildMiddlewarePrefetchSkipResult(devPageMatch);
	if (prefetchSkipResult) return prefetchSkipResult;
	if (isOutsideBasePathUnclaimed()) return outOfBasePathNotFound();
	refreshDataRewriteHeader();
	return {
		type: "render",
		resolvedUrl,
		renderOptions: isDataReq ? { isDataReq: true } : void 0,
		stagedHeaders: middlewareHeaders,
		requestHeaders: request.headers,
		middlewareStatus,
		isDataReq
	};
}
//#endregion
export { fetchWorkerFilesystemRoute, runPagesRequest, wrapMiddlewareWithBasePath };
