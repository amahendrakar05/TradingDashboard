import { createRequestContext, runWithRequestContext } from "../shims/unified-request-context.js";
import { getRequestExecutionContext } from "../shims/request-context.js";
import { reportRequestError } from "./instrumentation.js";
import { consumeDynamicUsage, getActiveDraftModeState, getAndClearPendingCookies, getDraftModeCookieHeader, isDraftModeRequest, markDynamicUsage, setHeadersAccessPhase } from "../shims/headers.js";
import { _drainPendingRevalidations } from "../shims/cache-request-state.js";
import { ensureFetchPatch, getCollectedFetchTags, setCurrentFetchCacheMode, setCurrentFetchSoftTags, setCurrentForceDynamicFetchDefault } from "../shims/fetch-cache.js";
import { setNavigationContext } from "../shims/navigation-context-state.js";
import { makeThenableParams } from "../shims/thenable-params.js";
import "../shims/navigation.js";
import { buildPageCacheTags } from "./implicit-tags.js";
import { applyRouteHandlerMiddlewareContext, finalizeRouteHandlerResponse } from "./app-route-handler-response.js";
import { isKnownDynamicAppRoute, isValidHTTPMethod } from "./app-route-handler-runtime.js";
import { createStaticGenerationHeadersContext } from "./app-static-generation.js";
import { getAppRouteHandlerRevalidateSeconds, hasAppRouteHandlerDefaultExport, resolveAppRouteHandlerMethod, shouldReadAppRouteHandlerCache } from "./app-route-handler-policy.js";
import { applyDraftModeCachePolicy, executeAppRouteHandler } from "./app-route-handler-execution.js";
import { readAppRouteHandlerCacheResponse } from "./app-route-handler-cache.js";
import { resolveAppRouteHandlerFetchCacheMode } from "./app-segment-config.js";
//#region src/server/app-route-handler-dispatch.ts
function isAppRouteHandlerFunction(value) {
	return typeof value === "function";
}
function buildRouteHandlerPageCacheTags(pathname, extraTags, routeSegments) {
	return buildPageCacheTags(pathname, extraTags, routeSegments, "route");
}
async function runInRouteHandlerRevalidationContext(options, renderFn) {
	await runWithRequestContext(createRequestContext({
		headersContext: createStaticGenerationHeadersContext({
			draftModeEnabled: false,
			draftModeSecret: options.draftModeSecret,
			dynamicConfig: options.dynamicConfig,
			routeKind: "route",
			routePattern: options.routePattern
		}),
		executionContext: getRequestExecutionContext(),
		unstableCacheRevalidation: "foreground"
	}), async () => {
		ensureFetchPatch();
		setCurrentFetchSoftTags(buildRouteHandlerPageCacheTags(options.cleanPathname, [], options.routeSegments));
		setCurrentFetchCacheMode(options.fetchCacheMode);
		setCurrentForceDynamicFetchDefault(options.dynamicConfig === "force-dynamic");
		try {
			await renderFn();
		} finally {
			await _drainPendingRevalidations();
		}
	});
}
async function dispatchAppRouteHandler(options) {
	const { route } = options;
	const handler = route.routeHandler;
	const method = options.request.method.toUpperCase();
	const revalidateSeconds = getAppRouteHandlerRevalidateSeconds(handler);
	const isDevelopment = options.isDevelopment ?? process.env.NODE_ENV === "development";
	const isProduction = options.isProduction ?? process.env.NODE_ENV === "production";
	const isDraftMode = getActiveDraftModeState() ?? isDraftModeRequest(options.request, options.draftModeSecret);
	const initialDraftModeCookie = getDraftModeCookieHeader();
	const hasDraftModeTransition = initialDraftModeCookie != null;
	const finalizeFrameworkResponse = (response, isHead = false) => {
		const finalized = finalizeRouteHandlerResponse(response, {
			pendingCookies: getAndClearPendingCookies(),
			draftCookie: initialDraftModeCookie,
			isHead
		});
		options.clearRequestContext();
		return applyDraftModeCachePolicy(applyRouteHandlerMiddlewareContext(finalized, options.middlewareContext), isDraftMode || hasDraftModeTransition);
	};
	if (hasAppRouteHandlerDefaultExport(handler) && isDevelopment) console.error("[vinext] Detected default export in route handler " + route.pattern + ". Export a named export for each HTTP method instead.");
	if (!isValidHTTPMethod(method)) return finalizeFrameworkResponse(new Response(null, { status: 400 }));
	const { allowHeaderForOptions, handlerFn, isAutoHead, shouldAutoRespondToOptions } = resolveAppRouteHandlerMethod(handler, method);
	if (shouldAutoRespondToOptions) return finalizeFrameworkResponse(new Response(null, {
		status: 204,
		headers: { Allow: allowHeaderForOptions }
	}));
	const resolvedHandlerFn = isAppRouteHandlerFunction(handlerFn) ? handlerFn : void 0;
	const fetchCacheMode = resolveAppRouteHandlerFetchCacheMode(handler);
	setCurrentFetchCacheMode(fetchCacheMode);
	setCurrentForceDynamicFetchDefault(handler.dynamic === "force-dynamic");
	if (revalidateSeconds !== null && shouldReadAppRouteHandlerCache({
		dynamicConfig: handler.dynamic,
		handlerFn: resolvedHandlerFn,
		isAutoHead,
		isKnownDynamic: isKnownDynamicAppRoute(route.pattern),
		isDraftMode: isDraftMode || hasDraftModeTransition,
		isProduction,
		method,
		revalidateSeconds
	}) && resolvedHandlerFn) {
		const cachedRouteResponse = await readAppRouteHandlerCacheResponse({
			basePath: options.basePath,
			buildPageCacheTags(pathname, extraTags) {
				return buildRouteHandlerPageCacheTags(pathname, extraTags, route.routeSegments);
			},
			cleanPathname: options.cleanPathname,
			clearRequestContext: options.clearRequestContext,
			consumeDynamicUsage,
			dynamicConfig: handler.dynamic,
			getCollectedFetchTags,
			handlerFn: resolvedHandlerFn,
			i18n: options.i18n,
			trailingSlash: options.trailingSlash,
			isAutoHead,
			isrDebug: options.isrDebug,
			isrGet: options.isrGet,
			isrRouteKey: options.isrRouteKey,
			isrSet: options.isrSet,
			markDynamicUsage,
			middlewareContext: options.middlewareContext,
			params: options.params,
			requestUrl: options.request.url,
			revalidateSearchParams: options.searchParams,
			expireSeconds: options.expireSeconds,
			revalidateSeconds,
			routePattern: route.pattern,
			runInRevalidationContext(renderFn) {
				return runInRouteHandlerRevalidationContext({
					cleanPathname: options.cleanPathname,
					draftModeSecret: options.draftModeSecret,
					dynamicConfig: handler.dynamic,
					fetchCacheMode,
					routePattern: route.pattern,
					routeSegments: route.routeSegments
				}, renderFn);
			},
			scheduleBackgroundRegeneration(key, renderFn) {
				options.scheduleBackgroundRegeneration(key, renderFn, {
					routerKind: "App Router",
					routePath: route.pattern,
					routeType: "route"
				});
			},
			setHeadersAccessPhase,
			setNavigationContext
		});
		if (cachedRouteResponse) return cachedRouteResponse;
	}
	if (resolvedHandlerFn) return executeAppRouteHandler({
		basePath: options.basePath,
		buildPageCacheTags(pathname, extraTags) {
			return buildRouteHandlerPageCacheTags(pathname, extraTags, route.routeSegments);
		},
		cleanPathname: options.cleanPathname,
		clearRequestContext: options.clearRequestContext,
		consumeDynamicUsage,
		draftModeSecret: options.draftModeSecret,
		executionContext: getRequestExecutionContext(),
		getAndClearPendingCookies,
		getCollectedFetchTags,
		getActiveDraftModeState,
		getDraftModeCookieHeader,
		handler,
		handlerFn: resolvedHandlerFn,
		i18n: options.i18n,
		trailingSlash: options.trailingSlash,
		isAutoHead,
		initialDraftModeCookie,
		isDraftMode,
		isProduction,
		isrDebug: options.isrDebug,
		isrRouteKey: options.isrRouteKey,
		isrSet: options.isrSet,
		markDynamicUsage,
		method,
		middlewareContext: options.middlewareContext,
		middlewareRequestHeaders: options.middlewareRequestHeaders,
		params: options.params === null ? null : makeThenableParams(options.params),
		reportRequestError(error, request, context) {
			reportRequestError(error, request, context);
		},
		request: options.request,
		expireSeconds: options.expireSeconds,
		revalidateSeconds,
		routePattern: route.pattern,
		setHeadersAccessPhase
	});
	return finalizeFrameworkResponse(new Response(null, { status: 405 }));
}
//#endregion
export { dispatchAppRouteHandler };
