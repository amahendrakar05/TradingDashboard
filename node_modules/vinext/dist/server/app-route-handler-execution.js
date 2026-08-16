import { NEVER_CACHE_CONTROL, applyCdnResponseHeaders } from "./cache-control.js";
import { isDraftModeRequest, setHeadersContext } from "../shims/headers.js";
import { _drainPendingRevalidations } from "../shims/cache-request-state.js";
import { isPossibleAppRouteActionRequest } from "./app-action-request.js";
import { runWithRootParamsUsage } from "../shims/root-params.js";
import { applyRouteHandlerMiddlewareContext, applyRouteHandlerRevalidateHeader, assertSupportedAppRouteHandlerResponse, buildAppRouteCacheValue, finalizeRouteHandlerResponse, markRouteHandlerCacheMiss } from "./app-route-handler-response.js";
import { createTrackedAppRouteRequest, markKnownDynamicAppRoute } from "./app-route-handler-runtime.js";
import { createStaticGenerationHeadersContext, getAppRouteStaticGenerationErrorMessage } from "./app-static-generation.js";
import { resolveAppRouteHandlerSpecialError, shouldApplyAppRouteHandlerRevalidateHeader, shouldWriteAppRouteHandlerCache } from "./app-route-handler-policy.js";
//#region src/server/app-route-handler-execution.ts
function applyDraftModeCachePolicy(response, isDraftMode) {
	if (!isDraftMode) return response;
	const headers = new Headers(response.headers);
	applyCdnResponseHeaders(headers, { cacheControl: NEVER_CACHE_CONTROL });
	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers
	});
}
function configureAppRouteStaticGenerationContext(options) {
	if (options.dynamicConfig === "force-static" || options.dynamicConfig === "error") {
		setHeadersContext(createStaticGenerationHeadersContext({
			draftModeEnabled: options.isDraftMode ?? (options.draftModeSecret !== void 0 && isDraftModeRequest(options.request, options.draftModeSecret)),
			draftModeSecret: options.draftModeSecret,
			dynamicConfig: options.dynamicConfig,
			routeKind: "route",
			routePattern: options.routePattern
		}));
		options.setHeadersAccessPhase?.("route-handler");
	}
}
async function runAppRouteHandler(options) {
	options.consumeDynamicUsage();
	configureAppRouteStaticGenerationContext(options);
	const trackedRequest = createTrackedAppRouteRequest(options.request, {
		basePath: options.basePath,
		i18n: options.i18n,
		trailingSlash: options.trailingSlash,
		middlewareHeaders: options.middlewareRequestHeaders,
		onDynamicAccess() {
			options.markDynamicUsage();
		},
		requestMode: options.dynamicConfig === "force-static" || options.dynamicConfig === "error" ? options.dynamicConfig : "auto",
		staticGenerationErrorMessage(expression) {
			return getAppRouteStaticGenerationErrorMessage(options.routePattern, expression);
		}
	});
	const response = await runWithRootParamsUsage({
		kind: "route-handler",
		routePattern: options.routePattern ?? new URL(options.request.url).pathname
	}, () => options.handlerFn(trackedRequest.request, { params: options.params }));
	return {
		dynamicUsedInHandler: options.consumeDynamicUsage(),
		response
	};
}
async function executeAppRouteHandler(options) {
	const previousHeadersPhase = options.setHeadersAccessPhase("route-handler");
	try {
		let handlerResult;
		try {
			handlerResult = await runAppRouteHandler({
				...options,
				dynamicConfig: options.handler.dynamic
			});
		} finally {
			await _drainPendingRevalidations();
		}
		const { dynamicUsedInHandler, response } = handlerResult;
		assertSupportedAppRouteHandlerResponse(response);
		const handlerSetCacheControl = response.headers.has("cache-control");
		if (dynamicUsedInHandler) markKnownDynamicAppRoute(options.routePattern);
		const pendingCookies = options.getAndClearPendingCookies();
		const handlerDraftCookie = options.getDraftModeCookieHeader();
		const draftCookie = handlerDraftCookie ?? options.initialDraftModeCookie;
		const shouldApplyDraftPolicy = (options.getActiveDraftModeState?.() ?? options.isDraftMode === true) || draftCookie != null;
		if (handlerDraftCookie != null) markKnownDynamicAppRoute(options.routePattern);
		const routeTags = options.buildPageCacheTags(options.cleanPathname, options.getCollectedFetchTags());
		if (shouldApplyAppRouteHandlerRevalidateHeader({
			dynamicUsedInHandler,
			handlerSetCacheControl,
			isAutoHead: options.isAutoHead,
			isDraftMode: shouldApplyDraftPolicy,
			method: options.method,
			revalidateSeconds: options.revalidateSeconds
		})) {
			const revalidateSeconds = options.revalidateSeconds;
			if (revalidateSeconds == null) throw new Error("Expected route handler revalidate seconds");
			applyRouteHandlerRevalidateHeader(response, revalidateSeconds, options.expireSeconds, routeTags);
		}
		if (shouldWriteAppRouteHandlerCache({
			dynamicConfig: options.handler.dynamic,
			dynamicUsedInHandler,
			handlerSetCacheControl,
			isAutoHead: options.isAutoHead,
			isDraftMode: shouldApplyDraftPolicy,
			isProduction: options.isProduction,
			method: options.method,
			revalidateSeconds: options.revalidateSeconds
		})) {
			markRouteHandlerCacheMiss(response);
			const routeClone = response.clone();
			const routeKey = options.isrRouteKey(options.cleanPathname);
			const revalidateSeconds = options.revalidateSeconds;
			if (revalidateSeconds == null) throw new Error("Expected route handler cache revalidate seconds");
			const routeWritePromise = (async () => {
				try {
					const routeCacheValue = await buildAppRouteCacheValue(routeClone);
					await options.isrSet(routeKey, routeCacheValue, revalidateSeconds, routeTags, options.expireSeconds);
					options.isrDebug?.("route cache written", routeKey);
				} catch (cacheErr) {
					console.error("[vinext] ISR route cache write error:", cacheErr);
				}
			})();
			options.executionContext?.waitUntil(routeWritePromise);
		}
		options.clearRequestContext();
		return applyDraftModeCachePolicy(applyRouteHandlerMiddlewareContext(finalizeRouteHandlerResponse(response, {
			pendingCookies,
			draftCookie,
			isHead: options.isAutoHead
		}), options.middlewareContext), shouldApplyDraftPolicy);
	} catch (error) {
		const pendingCookies = options.getAndClearPendingCookies();
		const handlerDraftCookie = options.getDraftModeCookieHeader();
		const draftCookie = handlerDraftCookie ?? options.initialDraftModeCookie;
		const shouldApplyDraftPolicy = (options.getActiveDraftModeState?.() ?? options.isDraftMode === true) || draftCookie != null;
		if (handlerDraftCookie != null) markKnownDynamicAppRoute(options.routePattern);
		const specialError = resolveAppRouteHandlerSpecialError(error, options.request.url, { isAction: isPossibleAppRouteActionRequest(options.request) });
		options.clearRequestContext();
		if (specialError) {
			if (specialError.kind === "redirect") return applyDraftModeCachePolicy(applyRouteHandlerMiddlewareContext(finalizeRouteHandlerResponse(new Response(null, {
				status: specialError.statusCode,
				headers: { Location: specialError.location }
			}), {
				pendingCookies,
				draftCookie,
				isHead: options.isAutoHead
			}), options.middlewareContext), shouldApplyDraftPolicy);
			return applyDraftModeCachePolicy(applyRouteHandlerMiddlewareContext(new Response(null, { status: specialError.statusCode }), options.middlewareContext), shouldApplyDraftPolicy);
		}
		console.error("[vinext] Route handler error:", error);
		options.reportRequestError(error instanceof Error ? error : new Error(String(error)), {
			path: options.cleanPathname,
			method: options.request.method,
			headers: Object.fromEntries(options.request.headers.entries())
		}, {
			routerKind: "App Router",
			routePath: options.routePattern,
			routeType: "route"
		});
		return applyDraftModeCachePolicy(applyRouteHandlerMiddlewareContext(new Response(null, { status: 500 }), options.middlewareContext), shouldApplyDraftPolicy);
	} finally {
		options.setHeadersAccessPhase(previousHeadersPhase);
	}
}
//#endregion
export { applyDraftModeCachePolicy, executeAppRouteHandler, runAppRouteHandler };
