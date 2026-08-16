import { createRequestContext, runWithRequestContext } from "../shims/unified-request-context.js";
import { addBasePathToPathname, hasBasePath, stripBasePath } from "../utils/base-path.js";
import { getRequestExecutionContext } from "../shims/request-context.js";
import { VINEXT_MW_CTX_HEADER, VINEXT_PRERENDER_ROUTE_PARAMS_HEADER, VINEXT_PRERENDER_SPECULATIVE_HEADER } from "../utils/protocol-headers.js";
import { ACTION_REVALIDATED_HEADER } from "./headers.js";
import { requestContextFromRequest } from "../config/request-context.js";
import { isExternalUrl } from "../utils/external-url.js";
import { notFoundResponse } from "./http-error-responses.js";
import { cloneRequestWithHeaders, cloneRequestWithUrl, filterInternalHeaders, normalizeTrailingSlash, resolvePublicFileRoute } from "./request-pipeline.js";
import { headersContextFromRequest } from "../shims/headers.js";
import { ensureFetchPatch, setCurrentFetchSoftTags } from "../shims/fetch-cache.js";
import { mergeRewriteQuery } from "../utils/query.js";
import { getScriptNonceFromHeaderSources } from "./csp.js";
import { normalizeDefaultLocalePathname } from "./pages-i18n.js";
import { buildNextDataNotFoundResponse, normalizePagesDataRequest } from "./pages-data-route.js";
import { DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES, isImageOptimizationPath, resolveDevImageRedirect } from "./image-optimization.js";
import { VINEXT_RSC_CACHE_BUSTING_SEARCH_PARAM, createRscRedirectLocation, hasRscCacheBustingSearchParam, resolveInvalidRscCacheBustingRequest, stripRscCacheBustingSearchParam, stripRscSuffix } from "./app-rsc-cache-busting.js";
import { mergeMiddlewareResponseHeaders } from "./middleware-response-headers.js";
import "./app-page-response.js";
import { parseNextHttpErrorDigest } from "./next-error-digest.js";
import { matchPrerenderRouteParamsPayload, readTrustedPrerenderRouteParams, serializePrerenderRouteParamsHeader } from "./prerender-route-params.js";
import { getRenderedConcreteUrlPathsForRoute } from "./pregenerated-concrete-paths.js";
import { createServerActionNotFoundResponse, getServerActionNotFoundMessage } from "./server-action-not-found.js";
import { buildPageCacheTags } from "./implicit-tags.js";
import { buildPostMwRequestContext } from "./app-post-middleware-context.js";
import { pickRootParams, setRootParams } from "../shims/root-params.js";
import { createRouteTreePrefetchResponse, isRouteTreePrefetchRequest } from "./app-route-tree-prefetch.js";
import { flattenErrorCauses } from "../utils/error-cause.js";
import { finalizeAppRscResponse } from "./app-rsc-response-finalizer.js";
import { normalizeRscRequest } from "./app-rsc-request-normalization.js";
import { runWithPrerenderWorkUnit } from "./prerender-work-unit-setup.js";
//#region src/server/app-rsc-handler.ts
const STATIC_METADATA_CONFIG_HEADER_OVERRIDES = /* @__PURE__ */ new Set(["cache-control"]);
const HAS_CONFIG_HEADERS = process.env.__VINEXT_HAS_CONFIG_HEADERS !== "false";
const HAS_CONFIG_REDIRECTS = process.env.__VINEXT_HAS_CONFIG_REDIRECTS !== "false";
const HAS_CONFIG_REWRITES = process.env.__VINEXT_HAS_CONFIG_REWRITES !== "false";
function applyMiddlewareContextToResponse(response, middlewareContext) {
	if (!middlewareContext.headers && middlewareContext.status == null) return response;
	const headers = new Headers(response.headers);
	mergeMiddlewareResponseHeaders(headers, middlewareContext.headers);
	return new Response(response.body, {
		status: middlewareContext.status ?? response.status,
		statusText: response.statusText,
		headers
	});
}
function hasProperty(value, key) {
	return key in value;
}
function isEdgeRouteHandler(handler) {
	if (!handler || typeof handler !== "object" || !hasProperty(handler, "runtime")) return false;
	return handler.runtime === "edge" || handler.runtime === "experimental-edge";
}
function isExecutionContextLike(value) {
	if (!value || typeof value !== "object") return false;
	return hasProperty(value, "waitUntil") && typeof value.waitUntil === "function";
}
function createMissingServerActionResponse(options, actionId) {
	console.warn(getServerActionNotFoundMessage(actionId));
	options.clearRequestContext();
	return createServerActionNotFoundResponse();
}
function redirectDestinationWithBasePath(destination, basePath, hadBasePath) {
	if (!basePath || !hadBasePath || isExternalUrl(destination) || hasBasePath(destination, basePath)) return destination;
	return basePath + destination;
}
async function applyRewrite(options, cleanPathname) {
	if (!HAS_CONFIG_REWRITES || !options.rewrites.length) return null;
	const sourcePathname = options.paramsPathname ?? cleanPathname;
	const configMatchers = await import("../config/config-matchers.js");
	const rewritten = configMatchers.matchRewrite(sourcePathname, options.rewrites, options.requestContext, options.basePathState, options.paramsPathname);
	if (!rewritten) return null;
	if (isExternalUrl(rewritten)) {
		options.clearRequestContext();
		return configMatchers.proxyExternalRequest(options.request, rewritten);
	}
	return rewritten;
}
function requestContextForResolvedUrl(requestContext, resolvedUrl, baseUrl) {
	return {
		cookies: requestContext.cookies,
		headers: requestContext.headers,
		host: requestContext.host,
		query: new URL(resolvedUrl, baseUrl).searchParams
	};
}
function pathnameForResolvedUrl(resolvedUrl) {
	return resolvedUrl.split("#", 1)[0].split("?", 1)[0];
}
async function applyConfigHeadersToMiddlewareRedirect(response, options) {
	if (response.status < 300 || response.status >= 400) return response;
	if (!HAS_CONFIG_HEADERS || !options.configHeaders.length) return response;
	const { applyConfigHeadersToResponse } = await import("./config-headers.js");
	const headers = new Headers();
	applyConfigHeadersToResponse(headers, {
		configHeaders: options.configHeaders,
		pathname: options.pathname,
		requestContext: options.requestContext,
		basePathState: options.basePathState
	});
	if (!headers.entries().next().done) {
		mergeMiddlewareResponseHeaders(headers, response.headers);
		return new Response(response.body, {
			status: response.status,
			statusText: response.statusText,
			headers
		});
	}
	return response;
}
function requestWithoutRscCacheBustingSearchParam(request) {
	const url = new URL(request.url);
	if (!hasRscCacheBustingSearchParam(url)) return request;
	stripRscCacheBustingSearchParam(url);
	return cloneRequestWithUrl(request.body ? request.clone() : request, url.toString());
}
function requestWithoutRscSuffix(request) {
	const url = new URL(request.url);
	const pathname = stripRscSuffix(url.pathname);
	if (pathname === url.pathname) return request;
	url.pathname = pathname;
	return cloneRequestWithUrl(request.body ? request.clone() : request, url.toString());
}
async function handleAppRscRequest(options, request, preMiddlewareRequestContext, isDataRequest, isMiddlewareDataRequest, pagesDataRequest) {
	const handlerStart = process.env.NODE_ENV !== "production" ? performance.now() : 0;
	if (process.env.NODE_ENV !== "production") {
		const originBlock = options.validateDevRequestOrigin?.(request);
		if (originBlock) return originBlock;
	}
	const canHandleOutsideBasePath = Boolean(options.runMiddleware) || [
		...options.configRedirects,
		...options.configRewrites.beforeFiles,
		...options.configRewrites.afterFiles,
		...options.configRewrites.fallback,
		...options.configHeaders
	].some((rule) => rule.basePath === false);
	const normalized = normalizeRscRequest(request, options.basePath, canHandleOutsideBasePath);
	if (normalized instanceof Response) return normalized;
	const { url, isRscRequest, interceptionContextHeader, mountedSlotsHeader, renderMode, clientReuseManifest, hadBasePath } = normalized;
	const { requestCleanPathname } = normalized;
	let { pathname, cleanPathname } = normalized;
	let resolvedUrl = cleanPathname + url.search;
	const originalResolvedUrl = resolvedUrl;
	const getResolvedSearchParams = () => new URL(resolvedUrl, url).searchParams;
	const canonicalPathname = cleanPathname;
	const basePathState = {
		basePath: options.basePath,
		hadBasePath
	};
	let cleanPathnameIsRequestPathname = true;
	const matchCleanPathname = () => cleanPathnameIsRequestPathname && options.matchRequestRoute ? options.matchRequestRoute(requestCleanPathname) : options.matchRoute(cleanPathname);
	if (pathname === "/__vinext/prerender/static-params" || pathname === "/__vinext/prerender/pages-static-paths") {
		const { handleAppPrerenderEndpoint } = await import("./app-prerender-endpoints.js");
		const prerenderEndpointResponse = await handleAppPrerenderEndpoint(request, {
			isPrerenderEnabled() {
				return process.env.VINEXT_PRERENDER === "1";
			},
			loadPagesRoutes: options.loadPrerenderPagesRoutes,
			pathname,
			rootParamNamesByPattern: options.rootParamNamesByPattern,
			staticParamsMap: options.staticParamsMap
		});
		if (prerenderEndpointResponse) return prerenderEndpointResponse;
	}
	const trailingSlashRedirect = normalizeTrailingSlash(requestCleanPathname, hadBasePath ? options.basePath : "", options.trailingSlash, url.search);
	if (trailingSlashRedirect) return trailingSlashRedirect;
	const matchPathname = (p) => normalizeDefaultLocalePathname(p, options.i18nConfig, { hostname: url.hostname });
	const redirectPathname = matchPathname(requestCleanPathname);
	const configMatchers = HAS_CONFIG_REDIRECTS && options.configRedirects.length ? await import("../config/config-matchers.js") : null;
	const redirect = configMatchers ? configMatchers.matchRedirect(redirectPathname, options.configRedirects, preMiddlewareRequestContext, basePathState) : null;
	if (configMatchers && redirect) {
		const destination = configMatchers.sanitizeDestination(redirectDestinationWithBasePath(redirect.destination, options.basePath, hadBasePath));
		const location = isRscRequest && request.headers.get("RSC") === "1" ? await createRscRedirectLocation(destination, request) : configMatchers.preserveRedirectDestinationQuery(destination, url.search);
		return new Response(null, {
			status: redirect.permanent ? 308 : 307,
			headers: { Location: location }
		});
	}
	const rscCacheBustingRedirect = hadBasePath ? await resolveInvalidRscCacheBustingRequest({
		isRscRequest,
		request
	}) : null;
	if (rscCacheBustingRedirect) return rscCacheBustingRedirect;
	const normalizedUserlandRequest = requestWithoutRscSuffix(request);
	const userlandRequest = requestWithoutRscCacheBustingSearchParam(normalizedUserlandRequest);
	const middlewareContext = {
		headers: null,
		requestHeaders: null,
		status: null
	};
	let didMiddlewareRewrite = false;
	let didMiddlewareRewritePathname = false;
	if (options.runMiddleware) {
		const middlewareResult = await options.runMiddleware({
			cleanPathname,
			context: middlewareContext,
			hadBasePath,
			isDataRequest: isMiddlewareDataRequest,
			request: userlandRequest
		});
		if (middlewareResult.kind === "response") return applyConfigHeadersToMiddlewareRedirect(middlewareResult.response, {
			basePathState,
			configHeaders: options.configHeaders,
			pathname: matchPathname(requestCleanPathname),
			requestContext: preMiddlewareRequestContext
		});
		cleanPathname = middlewareResult.cleanPathname;
		didMiddlewareRewrite = middlewareResult.rewritten;
		if (didMiddlewareRewrite || cleanPathname !== normalized.cleanPathname) cleanPathnameIsRequestPathname = false;
		didMiddlewareRewritePathname = cleanPathname !== normalized.cleanPathname;
		if (middlewareResult.search !== null) url.search = middlewareResult.search;
		resolvedUrl = cleanPathname + url.search;
	}
	const scriptNonce = getScriptNonceFromHeaderSources(request.headers, middlewareContext.headers);
	const postMiddlewareRequestContext = buildPostMwRequestContext(userlandRequest);
	let filesystemRouteEligible = hadBasePath || didMiddlewareRewrite;
	const validateClaimedOutsideBasePathRsc = async () => {
		if (hadBasePath || !filesystemRouteEligible) return null;
		return resolveInvalidRscCacheBustingRequest({
			isRscRequest,
			request
		});
	};
	for (const rewrite of options.configRewrites.beforeFiles) {
		const beforeFilesRewrite = await applyRewrite({
			basePathState,
			clearRequestContext: options.clearRequestContext,
			request: normalizedUserlandRequest,
			requestContext: requestContextForResolvedUrl(postMiddlewareRequestContext, resolvedUrl, url),
			paramsPathname: matchPathname(cleanPathnameIsRequestPathname ? requestCleanPathname : cleanPathname),
			rewrites: [rewrite]
		}, matchPathname(cleanPathname));
		if (beforeFilesRewrite instanceof Response) return beforeFilesRewrite;
		if (beforeFilesRewrite) {
			resolvedUrl = mergeRewriteQuery(resolvedUrl, beforeFilesRewrite);
			cleanPathname = pathnameForResolvedUrl(resolvedUrl);
			cleanPathnameIsRequestPathname = false;
			filesystemRouteEligible = true;
		}
	}
	const claimedRscCacheBustingRedirect = await validateClaimedOutsideBasePathRsc();
	if (claimedRscCacheBustingRedirect) return claimedRscCacheBustingRedirect;
	const actionId = request.headers.get("x-rsc-action") ?? request.headers.get("next-action");
	const isPostRequest = request.method.toUpperCase() === "POST";
	const contentType = request.headers.get("content-type") || "";
	const isProgressiveActionRequest = isPostRequest && !actionId && contentType.startsWith("multipart/form-data");
	let resolvedLateRewritesForAction = false;
	if (!filesystemRouteEligible && (actionId || isProgressiveActionRequest)) {
		let actionMatch = null;
		for (const rewrite of options.configRewrites.afterFiles) {
			const rewritten = await applyRewrite({
				basePathState,
				clearRequestContext: options.clearRequestContext,
				request: normalizedUserlandRequest,
				requestContext: requestContextForResolvedUrl(postMiddlewareRequestContext, resolvedUrl, url),
				paramsPathname: matchPathname(cleanPathnameIsRequestPathname ? requestCleanPathname : cleanPathname),
				rewrites: [rewrite]
			}, matchPathname(cleanPathname));
			if (rewritten instanceof Response) return rewritten;
			if (!rewritten) continue;
			resolvedUrl = mergeRewriteQuery(resolvedUrl, rewritten);
			cleanPathname = pathnameForResolvedUrl(resolvedUrl);
			cleanPathnameIsRequestPathname = false;
			filesystemRouteEligible = true;
			actionMatch = matchCleanPathname();
			if (actionMatch) break;
		}
		if (!actionMatch) for (const rewrite of options.configRewrites.fallback) {
			const rewritten = await applyRewrite({
				basePathState,
				clearRequestContext: options.clearRequestContext,
				request: normalizedUserlandRequest,
				requestContext: requestContextForResolvedUrl(postMiddlewareRequestContext, resolvedUrl, url),
				paramsPathname: matchPathname(cleanPathnameIsRequestPathname ? requestCleanPathname : cleanPathname),
				rewrites: [rewrite]
			}, matchPathname(cleanPathname));
			if (rewritten instanceof Response) return rewritten;
			if (!rewritten) continue;
			resolvedUrl = mergeRewriteQuery(resolvedUrl, rewritten);
			cleanPathname = pathnameForResolvedUrl(resolvedUrl);
			cleanPathnameIsRequestPathname = false;
			filesystemRouteEligible = true;
			actionMatch = matchCleanPathname();
			if (actionMatch) break;
		}
		resolvedLateRewritesForAction = filesystemRouteEligible;
	}
	const lateActionRscCacheBustingRedirect = await validateClaimedOutsideBasePathRsc();
	if (lateActionRscCacheBustingRedirect) return lateActionRscCacheBustingRedirect;
	if (filesystemRouteEligible && isImageOptimizationPath(cleanPathname)) {
		const imageRedirect = resolveDevImageRedirect(url, [...options.imageConfig?.deviceSizes ?? DEFAULT_DEVICE_SIZES, ...options.imageConfig?.imageSizes ?? DEFAULT_IMAGE_SIZES], options.imageConfig?.qualities, { isDev: options.isDev });
		if (!imageRedirect) return new Response("Invalid image optimization parameters", { status: 400 });
		return Response.redirect(new URL(imageRedirect, url.origin).href, 302);
	}
	if (filesystemRouteEligible && options.handleMetadataRouteRequest) {
		const metadataRouteResponse = await options.handleMetadataRouteRequest(cleanPathname);
		if (metadataRouteResponse && HAS_CONFIG_HEADERS && options.configHeaders.length) {
			const { applyConfigHeadersToResponse } = await import("./config-headers.js");
			applyConfigHeadersToResponse(metadataRouteResponse.headers, {
				basePathState,
				configHeaders: options.configHeaders,
				overwriteExisting: STATIC_METADATA_CONFIG_HEADER_OVERRIDES,
				pathname: matchPathname(cleanPathnameIsRequestPathname ? requestCleanPathname : cleanPathname),
				requestContext: preMiddlewareRequestContext
			});
		}
		if (metadataRouteResponse) return applyMiddlewareContextToResponse(metadataRouteResponse, middlewareContext);
	}
	const publicFileResponse = filesystemRouteEligible ? resolvePublicFileRoute({
		cleanPathname,
		middlewareContext,
		pathname,
		publicFiles: options.publicFiles,
		request
	}) : null;
	if (publicFileResponse) {
		options.clearRequestContext();
		return publicFileResponse;
	}
	stripRscCacheBustingSearchParam(url);
	const resolved = new URL(resolvedUrl, url);
	stripRscCacheBustingSearchParam(resolved);
	resolvedUrl = resolved.pathname + resolved.search + resolved.hash;
	options.setNavigationContext({
		pathname: canonicalPathname,
		searchParams: getResolvedSearchParams(),
		params: {}
	});
	const preActionMatch = filesystemRouteEligible ? matchCleanPathname() : null;
	if (preActionMatch) setRootParams(pickRootParams(preActionMatch.params, preActionMatch.route.rootParamNames));
	if (pagesDataRequest && didMiddlewareRewritePathname && preActionMatch) {
		const headers = new Headers();
		mergeMiddlewareResponseHeaders(headers, middlewareContext.headers);
		headers.set("content-type", "application/json");
		headers.set("x-nextjs-rewrite", resolvedUrl);
		options.clearRequestContext();
		return new Response("{}", { headers });
	}
	if (!filesystemRouteEligible && isPostRequest && actionId) {
		options.clearRequestContext();
		return notFoundResponse();
	}
	let progressiveActionResult = null;
	if (filesystemRouteEligible && isPostRequest && contentType.startsWith("multipart/form-data") && !actionId) {
		if (options.handleProgressiveActionRequest) progressiveActionResult = await options.handleProgressiveActionRequest({
			actionId,
			cleanPathname,
			contentType,
			middlewareContext,
			request,
			routeMatch: preActionMatch
		});
		else if (preActionMatch?.route.__loadPage && !preActionMatch.route.__loadRouteHandler) return createMissingServerActionResponse(options, null);
	}
	if (progressiveActionResult instanceof Response) return progressiveActionResult;
	const progressiveActionFormState = progressiveActionResult?.kind === "form-state" ? progressiveActionResult : null;
	const isProgressiveActionRender = progressiveActionFormState !== null;
	const formState = progressiveActionFormState?.formState ?? null;
	const failedProgressiveActionResult = progressiveActionFormState && "actionError" in progressiveActionFormState ? progressiveActionFormState : null;
	const actionFailed = failedProgressiveActionResult !== null;
	const actionError = failedProgressiveActionResult?.actionError;
	const actionErrorDigest = actionError && typeof actionError === "object" && "digest" in actionError ? String(actionError.digest) : null;
	const actionHttpFallbackStatus = actionErrorDigest ? parseNextHttpErrorDigest(actionErrorDigest)?.status ?? null : null;
	const normalizedProgressiveActionError = actionHttpFallbackStatus === null || actionHttpFallbackStatus === 404 ? actionError : { digest: "NEXT_NOT_FOUND" };
	if (actionFailed && middlewareContext.status === null && actionHttpFallbackStatus === null) middlewareContext.status = 500;
	const serverActionResponse = filesystemRouteEligible && isPostRequest && actionId && options.handleServerActionRequest ? await options.handleServerActionRequest({
		actionId,
		cleanPathname,
		contentType,
		interceptionContext: interceptionContextHeader,
		isRscRequest,
		middlewareContext,
		mountedSlotsHeader,
		request,
		routeMatch: preActionMatch,
		routePathname: cleanPathnameIsRequestPathname ? requestCleanPathname : cleanPathname,
		searchParams: getResolvedSearchParams()
	}) : null;
	if (serverActionResponse) return serverActionResponse;
	if (filesystemRouteEligible && isPostRequest && actionId && !options.handleServerActionRequest) return createMissingServerActionResponse(options, actionId);
	let match = preActionMatch;
	const renderPagesForMatchKind = async (matchKind) => {
		if (!filesystemRouteEligible) return null;
		const response = match === null || match.route.isDynamic ? await options.renderPagesFallback?.({
			appRouteMatch: match ?? null,
			allowRscDocumentFallback: didMiddlewareRewritePathname,
			isDataRequest,
			isRscRequest,
			matchKind,
			middlewareContext,
			pathname: resolvedUrl,
			pagesDataRequest,
			request,
			url
		}) ?? null : null;
		if (!response || !pagesDataRequest || resolvedUrl === originalResolvedUrl) return response;
		const headers = new Headers(response.headers);
		headers.set("x-nextjs-rewrite", resolvedUrl);
		return new Response(response.body, {
			headers,
			status: response.status,
			statusText: response.statusText
		});
	};
	const staticPagesFallbackResponse = await renderPagesForMatchKind("static");
	if (staticPagesFallbackResponse) {
		options.clearRequestContext();
		return staticPagesFallbackResponse;
	}
	if (!resolvedLateRewritesForAction && (!match || match.route.isDynamic)) for (const rewrite of options.configRewrites.afterFiles) {
		const afterFilesRewrite = await applyRewrite({
			basePathState,
			clearRequestContext: options.clearRequestContext,
			request: normalizedUserlandRequest,
			requestContext: requestContextForResolvedUrl(postMiddlewareRequestContext, resolvedUrl, url),
			paramsPathname: matchPathname(cleanPathnameIsRequestPathname ? requestCleanPathname : cleanPathname),
			rewrites: [rewrite]
		}, matchPathname(cleanPathname));
		if (afterFilesRewrite instanceof Response) return afterFilesRewrite;
		if (!afterFilesRewrite) continue;
		resolvedUrl = mergeRewriteQuery(resolvedUrl, afterFilesRewrite);
		cleanPathname = pathnameForResolvedUrl(resolvedUrl);
		cleanPathnameIsRequestPathname = false;
		filesystemRouteEligible = true;
		const claimedRscCacheBustingRedirect = await validateClaimedOutsideBasePathRsc();
		if (claimedRscCacheBustingRedirect) return claimedRscCacheBustingRedirect;
		match = matchCleanPathname();
		const rewrittenStaticPagesResponse = await renderPagesForMatchKind("static");
		if (rewrittenStaticPagesResponse) {
			options.clearRequestContext();
			return rewrittenStaticPagesResponse;
		}
		const rewrittenDynamicPagesResponse = await renderPagesForMatchKind("dynamic");
		if (rewrittenDynamicPagesResponse) {
			options.clearRequestContext();
			return rewrittenDynamicPagesResponse;
		}
		if (match) break;
	}
	const dynamicPagesFallbackResponse = await renderPagesForMatchKind("dynamic");
	if (dynamicPagesFallbackResponse) {
		options.clearRequestContext();
		return dynamicPagesFallbackResponse;
	}
	if (!resolvedLateRewritesForAction && !match) for (const rewrite of options.configRewrites.fallback) {
		const fallbackRewrite = await applyRewrite({
			basePathState,
			clearRequestContext: options.clearRequestContext,
			request: normalizedUserlandRequest,
			requestContext: requestContextForResolvedUrl(postMiddlewareRequestContext, resolvedUrl, url),
			paramsPathname: matchPathname(cleanPathnameIsRequestPathname ? requestCleanPathname : cleanPathname),
			rewrites: [rewrite]
		}, matchPathname(cleanPathname));
		if (fallbackRewrite instanceof Response) return fallbackRewrite;
		if (!fallbackRewrite) continue;
		resolvedUrl = mergeRewriteQuery(resolvedUrl, fallbackRewrite);
		cleanPathname = pathnameForResolvedUrl(resolvedUrl);
		cleanPathnameIsRequestPathname = false;
		filesystemRouteEligible = true;
		const claimedRscCacheBustingRedirect = await validateClaimedOutsideBasePathRsc();
		if (claimedRscCacheBustingRedirect) return claimedRscCacheBustingRedirect;
		match = matchCleanPathname();
		const rewrittenStaticPagesResponse = await renderPagesForMatchKind("static");
		if (rewrittenStaticPagesResponse) {
			options.clearRequestContext();
			return rewrittenStaticPagesResponse;
		}
		const rewrittenDynamicPagesResponse = await renderPagesForMatchKind("dynamic");
		if (rewrittenDynamicPagesResponse) {
			options.clearRequestContext();
			return rewrittenDynamicPagesResponse;
		}
		if (match) break;
	}
	if (!filesystemRouteEligible) {
		options.clearRequestContext();
		const headers = new Headers();
		mergeMiddlewareResponseHeaders(headers, middlewareContext.headers);
		return notFoundResponse({ headers });
	}
	if (pagesDataRequest) {
		options.clearRequestContext();
		if (options.runMiddleware && (middlewareContext.status === null || middlewareContext.status === 200 || middlewareContext.status === 404)) {
			const response = buildNextDataNotFoundResponse();
			const headers = new Headers(response.headers);
			headers.set("x-nextjs-matched-path", matchPathname(canonicalPathname));
			if (resolvedUrl !== originalResolvedUrl) headers.set("x-nextjs-rewrite", resolvedUrl);
			return new Response("{}", {
				status: 200,
				headers
			});
		}
		return buildNextDataNotFoundResponse();
	}
	if (!match) {
		if (process.env.NODE_ENV !== "production" && canonicalPathname === "/favicon.ico") {
			options.clearRequestContext();
			return new Response("", { status: 404 });
		}
		const renderedNotFoundResponse = await options.renderNotFound({
			isRscRequest,
			middlewareContext,
			request,
			route: null,
			scriptNonce
		});
		if (renderedNotFoundResponse) return renderedNotFoundResponse;
		options.clearRequestContext();
		const headers = new Headers();
		mergeMiddlewareResponseHeaders(headers, middlewareContext.headers);
		return notFoundResponse({ headers });
	}
	const { route, params } = match;
	if (options.ensureRouteLoaded) await options.ensureRouteLoaded(route);
	const resolvedSearchParams = getResolvedSearchParams();
	if (isRouteTreePrefetchRequest(request) && !route.routeHandler) {
		const response = await createRouteTreePrefetchResponse(route, {
			buildId: options.buildId,
			prefetchInlining: options.prefetchInlining
		});
		options.clearRequestContext();
		return applyMiddlewareContextToResponse(response, middlewareContext);
	}
	const prerenderRouteParamsMatch = matchPrerenderRouteParamsPayload(readTrustedPrerenderRouteParams(request), route.pattern, params);
	const prerenderRouteParams = prerenderRouteParamsMatch?.params ?? null;
	const isPrerenderFallbackShell = prerenderRouteParamsMatch?.kind === "fallback-shell";
	const renderParams = prerenderRouteParams ?? params;
	let runtimeFallbackShells = [];
	if (options.createPprFallbackShells && request.method === "GET" && !isRscRequest && !isPrerenderFallbackShell && route.params) runtimeFallbackShells = options.createPprFallbackShells({
		params: route.params,
		pattern: route.pattern,
		rootParamNames: route.rootParamNames
	}, params);
	options.setNavigationContext({
		pathname: canonicalPathname,
		searchParams: resolvedSearchParams,
		params: renderParams
	});
	const rootParams = pickRootParams(renderParams, route.rootParamNames);
	setRootParams(rootParams);
	if (route.routeHandler) {
		setCurrentFetchSoftTags(buildPageCacheTags(cleanPathname, [], [...route.routeSegments], "route"));
		const routeHandlerRequest = isEdgeRouteHandler(route.routeHandler) ? userlandRequest : normalizedUserlandRequest;
		const routeHandlerUrl = new URL(routeHandlerRequest.url);
		const internalRscValues = isEdgeRouteHandler(route.routeHandler) ? [] : routeHandlerUrl.searchParams.getAll(VINEXT_RSC_CACHE_BUSTING_SEARCH_PARAM);
		routeHandlerUrl.search = resolvedSearchParams.toString();
		for (const internalRscValue of internalRscValues) routeHandlerUrl.searchParams.append(VINEXT_RSC_CACHE_BUSTING_SEARCH_PARAM, internalRscValue);
		return options.dispatchMatchedRouteHandler({
			cleanPathname,
			middlewareContext,
			params: route.isDynamic ? renderParams : null,
			request: new Request(routeHandlerUrl, routeHandlerRequest),
			route,
			searchParams: resolvedSearchParams
		});
	}
	const pageResponse = await options.dispatchMatchedPage({
		clientReuseManifest,
		cleanPathname,
		displayPathname: canonicalPathname,
		formState,
		actionError: normalizedProgressiveActionError,
		actionFailed,
		handlerStart,
		interceptionContext: interceptionContextHeader,
		interceptionPathname: cleanPathnameIsRequestPathname ? requestCleanPathname : cleanPathname,
		isProgressiveActionRender,
		isRscRequest,
		middlewareContext,
		mountedSlotsHeader,
		params: renderParams,
		pprFallbackCacheShells: runtimeFallbackShells,
		pprFallbackShell: isPrerenderFallbackShell ? {
			fallbackParamNames: prerenderRouteParamsMatch.fallbackParamNames,
			routePattern: route.pattern
		} : void 0,
		renderedConcreteUrlPaths: getRenderedConcreteUrlPathsForRoute(route.pattern),
		skipStaticParamsValidation: isPrerenderFallbackShell,
		staticParamsValidationParams: prerenderRouteParams === null || isPrerenderFallbackShell ? void 0 : params,
		rootParams,
		request,
		renderedPathAndSearch: resolvedUrl,
		route,
		scriptNonce,
		searchParams: resolvedSearchParams,
		renderMode
	});
	if (isProgressiveActionRender) return applyProgressiveActionSideEffects(pageResponse, progressiveActionFormState);
	return pageResponse;
}
/**
* Append `Set-Cookie` headers and the `x-action-revalidated` marker captured
* during progressive (no-JS) server action execution to the page render
* response. See issue #1483.
*
* Falls back to rebuilding the response when the headers object is immutable
* (e.g. `Response.redirect()`), so cookies set by the action ride out on a
* redirect issued during the rerender too.
*/
function applyProgressiveActionSideEffects(response, sideEffects) {
	const hasPendingCookies = sideEffects.pendingCookies.length > 0;
	const hasDraftCookie = Boolean(sideEffects.draftCookie);
	const hasRevalidationKind = sideEffects.revalidationKind !== 0;
	if (!hasPendingCookies && !hasDraftCookie && !hasRevalidationKind) return response;
	const applyTo = (headers) => {
		for (const cookie of sideEffects.pendingCookies) headers.append("Set-Cookie", cookie);
		if (sideEffects.draftCookie) headers.append("Set-Cookie", sideEffects.draftCookie);
		if (hasRevalidationKind) headers.set(ACTION_REVALIDATED_HEADER, JSON.stringify(sideEffects.revalidationKind));
	};
	try {
		applyTo(response.headers);
		return response;
	} catch {
		const headers = new Headers(response.headers);
		applyTo(headers);
		return new Response(response.body, {
			status: response.status,
			statusText: response.statusText,
			headers
		});
	}
}
function createAppRscHandler(options) {
	return async function appRscHandler(rawRequest, ctx) {
		options.registerCacheAdapters();
		await options.ensureInstrumentation?.();
		const mwCtx = rawRequest.headers.get(VINEXT_MW_CTX_HEADER);
		const pagesDataUrl = new URL(rawRequest.url);
		const pagesDataInScope = !options.basePath || hasBasePath(pagesDataUrl.pathname, options.basePath);
		if (pagesDataInScope) pagesDataUrl.pathname = stripBasePath(pagesDataUrl.pathname, options.basePath);
		const pagesDataCandidate = pagesDataInScope ? cloneRequestWithUrl(rawRequest, pagesDataUrl.toString()) : null;
		const pagesDataNormalization = options.renderPagesFallback && pagesDataCandidate ? normalizePagesDataRequest(pagesDataCandidate, options.buildId, "", typeof options.runMiddleware === "function" && options.trailingSlash) : null;
		if (pagesDataNormalization?.notFoundResponse) return pagesDataNormalization.notFoundResponse;
		const isPagesDataRequest = pagesDataNormalization?.isDataReq === true;
		const prerenderRouteParamsPayload = readTrustedPrerenderRouteParams(rawRequest);
		const isTrustedSpeculativePrerender = process.env.VINEXT_PRERENDER === "1" && rawRequest.headers.get("x-vinext-prerender-secret") !== null && rawRequest.headers.get("x-vinext-prerender-speculative") === "1";
		const filteredHeaders = filterInternalHeaders(rawRequest.headers);
		if (mwCtx !== null) filteredHeaders.set(VINEXT_MW_CTX_HEADER, mwCtx);
		const prerenderRouteParamsHeader = serializePrerenderRouteParamsHeader(prerenderRouteParamsPayload);
		if (prerenderRouteParamsHeader !== null) filteredHeaders.set(VINEXT_PRERENDER_ROUTE_PARAMS_HEADER, prerenderRouteParamsHeader);
		if (isTrustedSpeculativePrerender) filteredHeaders.set(VINEXT_PRERENDER_SPECULATIVE_HEADER, "1");
		let appRequest = rawRequest;
		if (pagesDataNormalization?.isDataReq) {
			const appRequestUrl = new URL(pagesDataNormalization.request.url);
			appRequestUrl.pathname = addBasePathToPathname(appRequestUrl.pathname, options.basePath);
			appRequest = cloneRequestWithUrl(pagesDataCandidate, appRequestUrl.toString());
		}
		const request = cloneRequestWithHeaders(appRequest, filteredHeaders);
		const pagesDataRequest = pagesDataNormalization?.isDataReq ? cloneRequestWithHeaders(pagesDataCandidate, filteredHeaders) : null;
		const executionContext = isExecutionContextLike(ctx) ? ctx : getRequestExecutionContext() ?? null;
		return runWithRequestContext(createRequestContext({
			headersContext: headersContextFromRequest(request, { draftModeSecret: options.draftModeSecret }),
			executionContext,
			unstableCacheRevalidation: "background"
		}), () => runWithPrerenderWorkUnit(async () => {
			ensureFetchPatch();
			const preMiddlewareRequestContext = requestContextFromRequest(request);
			let response;
			try {
				response = await handleAppRscRequest(options, request, preMiddlewareRequestContext, isPagesDataRequest, isPagesDataRequest, pagesDataRequest);
			} catch (error) {
				if (process.env.NODE_ENV !== "production") flattenErrorCauses(error);
				throw error;
			}
			return finalizeAppRscResponse(response, request, {
				basePath: options.basePath,
				configHeaders: options.configHeaders,
				i18nConfig: options.i18nConfig,
				requestContext: preMiddlewareRequestContext
			});
		}, { route: () => new URL(request.url).pathname }));
	};
}
//#endregion
export { createAppRscHandler };
