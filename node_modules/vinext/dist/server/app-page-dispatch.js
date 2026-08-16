import { createRequestContext, runWithRequestContext } from "../shims/unified-request-context.js";
import { getRequestExecutionContext } from "../shims/request-context.js";
import "../utils/protocol-headers.js";
import { AppElementsWire } from "./app-elements-wire.js";
import { APP_RSC_RENDER_MODE_PREFETCH_DYNAMIC_SHELL } from "./app-rsc-render-mode.js";
import "./app-elements.js";
import { consumeDynamicUsage, consumeInvalidDynamicUsageError, getAndClearPendingCookies, getDraftModeCookieHeader, getHeadersContext, isDraftModeRequest, peekDynamicUsage, peekRenderRequestApiUsage, runWithIsolatedDynamicUsage, setHeadersContext } from "../shims/headers.js";
import { _consumeRequestScopedCacheLife, _peekRequestScopedCacheLife } from "../shims/cache-request-state.js";
import { ensureFetchPatch, getCollectedFetchTags, peekDynamicFetchObservations, runWithFetchDedupe, setCurrentFetchCacheMode, setCurrentFetchSoftTags, setCurrentForceDynamicFetchDefault, setRefreshStaleFetchesInForeground } from "../shims/fetch-cache.js";
import { VINEXT_RSC_CONTENT_TYPE, VINEXT_RSC_VARY_HEADER, applyRscCompatibilityIdHeader, applyRscDeploymentIdHeader } from "./app-rsc-cache-busting.js";
import { mergeMiddlewareResponseHeaders } from "./middleware-response-headers.js";
import "./app-page-response.js";
import { buildRscRedirectFlightStream } from "./app-rsc-redirect-flight.js";
import { buildAppPageSpecialErrorResponse, probeAppPageThrownError, resolveAppPageSpecialError } from "./app-page-execution.js";
import { createAppPageTreePath } from "./app-page-route-wiring.js";
import { consumeAppPageRenderObservationState, discardAppPageRenderState } from "./app-page-render-observation.js";
import { resolveAppPageParentHttpAccessBoundary, resolveAppPageParentHttpAccessBoundaryModule } from "./app-page-boundary.js";
import { shouldServeStreamingMetadata } from "./streaming-metadata.js";
import { resolveAppPageNavigationParams } from "./app-page-element-builder.js";
import { createAppLayoutParamAccessTracker, isAppLayoutObservationUnsafeForStaticReuse } from "./app-layout-param-observation.js";
import { buildAppPageTags } from "./implicit-tags.js";
import { resolveAppPageMethodResponse } from "./app-page-method.js";
import { buildAppPageElement, resolveAppPageIntercept, resolveAppPageInterceptionRerenderTarget, validateAppPageDynamicParams } from "./app-page-request.js";
import { renderAppPageLifecycle } from "./app-page-render.js";
//#region src/server/app-page-dispatch.ts
function resolveAppPageRouteBoundaryModule(route, statusCode) {
	if (statusCode === 403) return route.forbidden ?? null;
	if (statusCode === 401) return route.unauthorized ?? null;
	if (statusCode === 404) return route.notFound ?? null;
	return null;
}
/**
* Request-time counterpart to the build-time `classifyLayoutSegmentConfig`
* (`build/report.ts`). Both classify a layout by its `dynamic`/`revalidate`
* segment config and agree on the shared cases (the build-time version
* normalizes `revalidate = false` to `Infinity` upstream, so both treat it as
* static); keep them aligned when either changes.
*
* The meaningful difference is scope, not logic: this request-time pass reads
* the resolved module value, so it classifies layouts that were never captured
* at build time (e.g. dev mode). Its result is merged on top of the build-time
* classification map in `createEffectiveLayoutClassifications`, so such layouts
* are classified here where they previously were not.
*/
function classifyLayoutSegmentConfigFromModule(layout) {
	if (!layout) return null;
	switch (layout.dynamic) {
		case "force-dynamic": return {
			kind: "dynamic",
			reason: {
				layer: "segment-config",
				key: "dynamic",
				value: "force-dynamic"
			}
		};
		case "force-static":
		case "error": return {
			kind: "static",
			reason: {
				layer: "segment-config",
				key: "dynamic",
				value: layout.dynamic
			}
		};
	}
	if (layout.revalidate === false || layout.revalidate === Infinity) return {
		kind: "static",
		reason: {
			layer: "segment-config",
			key: "revalidate",
			value: Infinity
		}
	};
	if (layout.revalidate === 0) return {
		kind: "dynamic",
		reason: {
			layer: "segment-config",
			key: "revalidate",
			value: 0
		}
	};
	return null;
}
function createEffectiveLayoutClassifications(route, includeReasons) {
	const classifications = new Map(route.__buildTimeClassifications ?? []);
	const reasons = includeReasons ? new Map(route.__buildTimeReasons ?? []) : null;
	for (let index = 0; index < route.layouts.length; index++) {
		const classification = classifyLayoutSegmentConfigFromModule(route.layouts[index]);
		if (classification === null) continue;
		classifications.set(index, classification.kind);
		reasons?.set(index, classification.reason);
	}
	return {
		buildTimeClassifications: classifications.size > 0 ? classifications : null,
		buildTimeReasons: reasons && reasons.size > 0 ? reasons : null
	};
}
function getEffectiveLayoutClassifications(route, debugClassification) {
	return createEffectiveLayoutClassifications(route, debugClassification !== void 0);
}
function shouldReadAppPageCache(options) {
	return options.isProduction && !options.isProgressiveActionRender && !options.isDraftMode && !options.isForceDynamic && (options.isRscRequest || !options.scriptNonce) && (options.revalidateSeconds === null || options.revalidateSeconds > 0);
}
function resolveAppPageCacheReadRevalidateSeconds(options) {
	if (options.revalidateSeconds === null && (options.isForceStatic || options.isDynamicError)) return Infinity;
	return options.revalidateSeconds ?? 0;
}
function hasSearchParams(searchParams) {
	return searchParams !== null && searchParams !== void 0 && searchParams.size > 0;
}
async function runAppPageRevalidationContext(options, renderFn) {
	const { createStaticGenerationHeadersContext } = await import("./app-static-generation.js");
	return runWithRequestContext(createRequestContext({
		headersContext: createStaticGenerationHeadersContext({
			draftModeEnabled: false,
			draftModeSecret: options.draftModeSecret,
			dynamicConfig: options.dynamicConfig,
			routeKind: "page",
			routePattern: options.routePattern
		}),
		currentFetchCacheMode: options.currentFetchCacheMode ?? null,
		currentForceDynamicFetchDefault: options.dynamicConfig === "force-dynamic",
		executionContext: getRequestExecutionContext(),
		unstableCacheRevalidation: "foreground"
	}), async () => {
		ensureFetchPatch();
		setRefreshStaleFetchesInForeground(process.env.VINEXT_PRERENDER === "1");
		setCurrentFetchSoftTags(buildAppPageTags(options.cleanPathname, [], options.routeSegments));
		options.setNavigationContext({
			pathname: options.displayPathname ?? options.cleanPathname,
			searchParams: new URLSearchParams(),
			params: options.params
		});
		return await runWithFetchDedupe(renderFn);
	});
}
function toInterceptOptions(interceptionContext, intercept) {
	return {
		interceptionContext,
		interceptLayouts: intercept.interceptLayouts,
		interceptLayoutSegments: intercept.interceptLayoutSegments,
		interceptBranchSegments: intercept.interceptBranchSegments,
		interceptNotFoundBranchSegments: intercept.interceptNotFoundBranchSegments,
		interceptNotFound: intercept.notFound,
		interceptNotFoundTreePosition: intercept.notFoundTreePosition,
		interceptPage: intercept.page,
		interceptParams: intercept.matchedParams,
		interceptSlotId: intercept.slotId ?? null,
		interceptSlotKey: intercept.slotKey,
		interceptSourceMatchedUrl: interceptionContext,
		interceptSourcePageSegments: intercept.sourcePageSegments ?? null
	};
}
async function dispatchAppPage(options) {
	const dispatch = () => runWithFetchDedupe(() => dispatchAppPageInner(options));
	if (!options.pprFallbackShell || !options.pprRuntime) return await dispatch();
	return await options.pprRuntime.run(options.pprFallbackShell, dispatch);
}
async function dispatchAppPageInner(options) {
	const route = options.route;
	const dynamicConfig = options.dynamicConfig;
	const currentRevalidateSeconds = options.revalidateSeconds;
	const isForceStatic = dynamicConfig === "force-static";
	const isDynamicError = dynamicConfig === "error";
	const isForceDynamic = dynamicConfig === "force-dynamic";
	const isPrerender = process.env.VINEXT_PRERENDER === "1";
	const serveStreamingMetadata = shouldServeStreamingMetadata(options.request.headers.get("user-agent") ?? "", options.htmlLimitedBots);
	const placeGeneratedMetadataInBody = (!isPrerender || options.pprFallbackShell !== void 0) && serveStreamingMetadata;
	const isPrefetchDynamicShell = options.renderMode === APP_RSC_RENDER_MODE_PREFETCH_DYNAMIC_SHELL;
	const isDraftMode = isDraftModeRequest(options.request, options.draftModeSecret);
	const requestHeadersContext = getHeadersContext();
	const shouldUseEmptySearchParams = isForceStatic || isPrefetchDynamicShell;
	const hasRequestSearchParams = !shouldUseEmptySearchParams && hasSearchParams(options.searchParams);
	const pageSearchParams = shouldUseEmptySearchParams ? new URLSearchParams() : options.searchParams;
	const layoutParamAccess = createAppLayoutParamAccessTracker();
	const hasActiveLoadingBoundary = Boolean(route.loading?.default);
	setCurrentFetchSoftTags(buildAppPageTags(options.cleanPathname, [], route.routeSegments));
	setCurrentFetchCacheMode(options.fetchCache ?? null);
	setCurrentForceDynamicFetchDefault(isForceDynamic);
	if (options.hasPageModule && !options.hasPageDefaultExport) {
		options.clearRequestContext();
		return new Response("Page has no default export", { status: 500 });
	}
	const methodResponse = resolveAppPageMethodResponse({
		dynamicConfig,
		hasGenerateStaticParams: options.hasGenerateStaticParams,
		isDynamicRoute: route.isDynamic,
		middlewareHeaders: options.middlewareContext.headers,
		request: options.request,
		revalidateSeconds: currentRevalidateSeconds
	});
	if (methodResponse) {
		options.clearRequestContext();
		return methodResponse;
	}
	if (isForceStatic || isDynamicError) {
		const { createStaticGenerationHeadersContext } = await import("./app-static-generation.js");
		setHeadersContext(createStaticGenerationHeadersContext({
			draftModeEnabled: isDraftMode,
			draftModeSecret: options.draftModeSecret,
			dynamicConfig,
			routeKind: "page",
			routePattern: route.pattern
		}));
		const staticNavigationParams = resolveAppPageNavigationParams(route, options.params, options.cleanPathname, null);
		options.setNavigationContext({
			pathname: options.displayPathname ?? options.cleanPathname,
			searchParams: new URLSearchParams(),
			params: staticNavigationParams
		});
	}
	if (shouldReadAppPageCache({
		isDraftMode,
		isForceDynamic,
		isProgressiveActionRender: options.isProgressiveActionRender === true,
		isProduction: options.isProduction,
		isRscRequest: options.isRscRequest,
		revalidateSeconds: currentRevalidateSeconds,
		scriptNonce: options.scriptNonce
	})) {
		const { readAppPageCacheResponse } = await import("./app-page-cache.js");
		const cachedPageResponse = await readAppPageCacheResponse({
			cleanPathname: options.cleanPathname,
			clearRequestContext: options.clearRequestContext,
			hasRequestSearchParams,
			isEdgeRuntime: options.isEdgeRuntime,
			isRscRequest: options.isRscRequest,
			isrDebug: options.isrDebug,
			isrGet: options.isrGet,
			isrHtmlKey: options.isrHtmlKey,
			isrRscKey: options.isrRscKey,
			isrSet: options.isrSet,
			interceptionContext: options.interceptionContext,
			middlewareHeaders: options.middlewareContext.headers,
			middlewareStatus: options.middlewareContext.status,
			mountedSlotsHeader: options.mountedSlotsHeader,
			renderMode: options.renderMode,
			expireSeconds: options.expireSeconds,
			revalidateSeconds: resolveAppPageCacheReadRevalidateSeconds({
				isDynamicError,
				isForceStatic,
				revalidateSeconds: currentRevalidateSeconds
			}),
			renderFreshPageForCache: async () => {
				const revalidationTarget = await resolveAppPageInterceptionRerenderTarget({
					cleanPathname: options.cleanPathname,
					currentParams: options.params,
					currentRoute: route,
					findIntercept: options.findIntercept,
					getRouteParamNames(sourceRoute) {
						return sourceRoute.params;
					},
					getSourceRoute(sourceRouteIndex) {
						return options.getSourceRoute(sourceRouteIndex);
					},
					isRscRequest: options.isRscRequest,
					toInterceptOpts(intercept) {
						return toInterceptOptions(options.interceptionContext, intercept);
					}
				});
				revalidationTarget.navigationParams = resolveAppPageNavigationParams(revalidationTarget.route, revalidationTarget.navigationParams, options.cleanPathname, revalidationTarget.interceptOpts);
				await options.ensureRouteLoaded?.(revalidationTarget.route);
				const revalidationDynamicConfig = options.resolveRouteDynamicConfig?.(revalidationTarget.route) ?? (revalidationTarget.route === route ? dynamicConfig : void 0);
				return runAppPageRevalidationContext({
					cleanPathname: options.cleanPathname,
					displayPathname: options.displayPathname,
					currentFetchCacheMode: options.resolveRouteFetchCacheMode?.(revalidationTarget.route) ?? (revalidationTarget.route === route ? options.fetchCache ?? null : null),
					draftModeSecret: options.draftModeSecret,
					dynamicConfig: revalidationDynamicConfig,
					params: revalidationTarget.navigationParams,
					routePattern: revalidationTarget.route.pattern,
					routeSegments: revalidationTarget.route.routeSegments,
					setNavigationContext: options.setNavigationContext
				}, async () => {
					const { renderAppPageCacheArtifacts } = await import("./app-page-cache-render.js");
					const revalidatedElement = await options.buildPageElement(revalidationTarget.route, revalidationTarget.params, revalidationTarget.interceptOpts, new URLSearchParams(), void 0, {
						observeMetadataSearchParamsAccess: revalidationDynamicConfig !== "force-static",
						observePageSearchParamsAccess: revalidationDynamicConfig !== "force-static",
						serveStreamingMetadata: false
					});
					const revalidatedOnError = options.createRscOnErrorHandler(options.cleanPathname, revalidationTarget.route.pattern);
					const rendered = await renderAppPageCacheArtifacts({
						basePath: options.basePath,
						captureRscData: true,
						cleanPathname: options.cleanPathname,
						clientTraceMetadata: options.clientTraceMetadata,
						element: revalidatedElement,
						getFontLinks: options.getFontLinks,
						getFontPreloads: options.getFontPreloads,
						getFontStyles: options.getFontStyles,
						getNavigationContext: options.getNavigationContext,
						loadSsrHandler: options.loadSsrHandler,
						mountedSlotsHeader: options.mountedSlotsHeader,
						navigationParams: revalidationTarget.navigationParams,
						onError: revalidatedOnError,
						reactMaxHeadersLength: options.reactMaxHeadersLength,
						renderToReadableStream: options.renderToReadableStream,
						rootParams: options.rootParams,
						route: revalidationTarget.route,
						waitForAllReady: true
					});
					options.clearRequestContext();
					return {
						html: rendered.html,
						htmlRenderObservation: rendered.htmlRenderObservation,
						linkHeader: rendered.linkHeader,
						rscData: rendered.rscData,
						rscRenderObservation: rendered.rscRenderObservation,
						tags: rendered.tags,
						cacheControl: rendered.cacheControl
					};
				});
			},
			scheduleBackgroundRegeneration(key, renderFn) {
				options.scheduleBackgroundRegeneration(key, renderFn, {
					routerKind: "App Router",
					routePath: route.pattern,
					routeType: "render"
				});
			}
		});
		if (cachedPageResponse) return cachedPageResponse;
	}
	if (options.skipStaticParamsValidation !== true && !(options.isProduction && isForceDynamic)) {
		const dynamicParamsResponse = await validateAppPageDynamicParams({
			clearRequestContext: options.clearRequestContext,
			enforceStaticParamsOnly: options.dynamicParamsConfig === false,
			generateStaticParams: options.generateStaticParams,
			isDynamicRoute: route.isDynamic,
			params: options.staticParamsValidationParams ?? options.params
		});
		if (dynamicParamsResponse) return dynamicParamsResponse;
	}
	const fallbackShellResponse = options.pprRuntime ? await options.pprRuntime.tryServe(options, currentRevalidateSeconds, isDraftMode, isForceStatic, isForceDynamic) : null;
	if (fallbackShellResponse) return fallbackShellResponse;
	let interceptDynamicConfig;
	let interceptDynamicConfigResolved = false;
	const interceptResult = await resolveAppPageIntercept({
		async buildPageElement(interceptRoute, interceptParams, interceptOpts, interceptSearchParams, interceptLayoutParamAccess) {
			const sourceDynamicConfig = interceptDynamicConfigResolved ? interceptDynamicConfig : options.resolveRouteDynamicConfig?.(interceptRoute);
			if (sourceDynamicConfig === "force-static" || sourceDynamicConfig === "error") {
				const { createStaticGenerationHeadersContext } = await import("./app-static-generation.js");
				setHeadersContext(createStaticGenerationHeadersContext({
					draftModeEnabled: isDraftMode,
					draftModeSecret: options.draftModeSecret,
					dynamicConfig: sourceDynamicConfig,
					routeKind: "page",
					routePattern: interceptRoute.pattern
				}));
			} else setHeadersContext(requestHeadersContext);
			setCurrentFetchCacheMode(options.resolveRouteFetchCacheMode?.(interceptRoute) ?? null);
			setCurrentForceDynamicFetchDefault(sourceDynamicConfig === "force-dynamic");
			return options.buildPageElement(interceptRoute, interceptParams, interceptOpts, interceptSearchParams, interceptLayoutParamAccess, {
				observeMetadataSearchParamsAccess: sourceDynamicConfig !== "force-static",
				observePageSearchParamsAccess: sourceDynamicConfig !== "force-static",
				serveStreamingMetadata: placeGeneratedMetadataInBody
			});
		},
		cleanPathname: options.cleanPathname,
		currentRoute: route,
		findIntercept(pathname) {
			return options.findIntercept(pathname);
		},
		getRouteParamNames(sourceRoute) {
			return sourceRoute.params;
		},
		getSourceRoute(sourceRouteIndex) {
			return options.getSourceRoute(sourceRouteIndex);
		},
		isRscRequest: options.isRscRequest,
		layoutParamAccess,
		resolveNavigationParams(sourceRoute, navigationParams, pathname, interceptOpts) {
			return resolveAppPageNavigationParams(sourceRoute, navigationParams, pathname, interceptOpts);
		},
		renderInterceptResponse(sourceRoute, interceptElement) {
			const interceptOnError = options.createRscOnErrorHandler(options.cleanPathname, sourceRoute.pattern);
			const interceptStream = options.renderToReadableStream(interceptElement, { onError: interceptOnError });
			const interceptHeaders = new Headers({
				"Content-Type": VINEXT_RSC_CONTENT_TYPE,
				Vary: VINEXT_RSC_VARY_HEADER
			});
			mergeMiddlewareResponseHeaders(interceptHeaders, options.middlewareContext.headers);
			applyRscCompatibilityIdHeader(interceptHeaders);
			applyRscDeploymentIdHeader(interceptHeaders);
			return new Response(interceptStream, {
				status: options.middlewareContext.status ?? 200,
				headers: interceptHeaders
			});
		},
		async resolveSearchParams(sourceRoute, searchParams) {
			await options.ensureRouteLoaded?.(sourceRoute);
			interceptDynamicConfig = options.resolveRouteDynamicConfig?.(sourceRoute);
			interceptDynamicConfigResolved = true;
			return interceptDynamicConfig === "force-static" ? new URLSearchParams() : searchParams;
		},
		searchParams: options.searchParams,
		setNavigationContext: options.setNavigationContext,
		toInterceptOpts(intercept) {
			return toInterceptOptions(options.interceptionContext, intercept);
		}
	});
	if (interceptResult.response) return interceptResult.response;
	const buildCurrentPageElement = () => buildAppPageElement({
		buildPageElement() {
			if (options.actionFailed) throw options.actionError;
			return options.buildPageElement(route, options.params, interceptResult.interceptOpts, pageSearchParams, layoutParamAccess, {
				observeMetadataSearchParamsAccess: !isForceStatic,
				observePageSearchParamsAccess: !isForceStatic,
				serveStreamingMetadata: placeGeneratedMetadataInBody
			});
		},
		async probePageSpecialError() {
			if (route.loading?.default) return null;
			return resolveAppPageSpecialError(await probeAppPageThrownError({
				probePage: () => options.probePage(pageSearchParams),
				runWithSuppressedHookWarning(probe) {
					return options.runWithSuppressedHookWarning(probe);
				}
			}));
		},
		renderErrorBoundaryPage(buildError) {
			return options.renderErrorBoundaryPage(buildError);
		},
		renderSpecialError(specialError) {
			return renderPageSpecialError(options, specialError, serveStreamingMetadata, interceptResult.interceptOpts);
		},
		resolveSpecialError: resolveAppPageSpecialError
	});
	const fallbackShellState = options.pprRuntime?.getState() ?? null;
	if (fallbackShellState && process.env.VINEXT_PRERENDER === "1" && !options.isRscRequest) {
		const warmupBuildResult = await buildCurrentPageElement();
		if (warmupBuildResult.response) return warmupBuildResult.response;
		await options.pprRuntime.warm({
			element: warmupBuildResult.element,
			onError: options.createRscOnErrorHandler(options.cleanPathname, route.pattern),
			renderToReadableStream: options.renderToReadableStream,
			state: fallbackShellState
		});
		discardAppPageRenderState();
	}
	const pageBuildResult = await buildCurrentPageElement();
	if (pageBuildResult.response) return pageBuildResult.response;
	const navigationParams = resolveAppPageNavigationParams(route, options.params, options.cleanPathname, interceptResult.interceptOpts);
	options.setNavigationContext({
		pathname: options.displayPathname ?? options.cleanPathname,
		searchParams: pageSearchParams,
		params: navigationParams
	});
	const layoutClassifications = getEffectiveLayoutClassifications(route, options.debugClassification);
	const activeFallbackShellState = options.pprRuntime?.getState() ?? null;
	const pprFallbackShellSignal = activeFallbackShellState?.abortController.signal;
	const pprFallbackShellReactSignal = activeFallbackShellState?.reactAbortController.signal;
	const isSpeculativePrerender = isPrerender && options.request.headers.get("x-vinext-prerender-speculative") === "1";
	return renderAppPageLifecycle({
		basePath: options.basePath,
		clientTraceMetadata: options.clientTraceMetadata,
		reactMaxHeadersLength: options.reactMaxHeadersLength,
		cleanPathname: options.cleanPathname,
		clearRequestContext: options.clearRequestContext,
		consumeDynamicUsage,
		peekDynamicUsage,
		consumeInvalidDynamicUsageError,
		consumeRenderObservationState: consumeAppPageRenderObservationState,
		createRscOnErrorHandler(pathname, routePath) {
			return options.createRscOnErrorHandler(pathname, routePath);
		},
		element: pageBuildResult.element,
		clientReuseManifest: options.clientReuseManifest,
		getDraftModeCookieHeader,
		getFontLinks: options.getFontLinks,
		getFontPreloads: options.getFontPreloads,
		getFontStyles: options.getFontStyles,
		getNavigationContext: options.getNavigationContext,
		getPageTags() {
			return buildAppPageTags(options.cleanPathname, getCollectedFetchTags(), route.routeSegments);
		},
		getRequestCacheLife() {
			return _consumeRequestScopedCacheLife();
		},
		peekRequestCacheLife() {
			return _peekRequestScopedCacheLife();
		},
		handlerStart: options.handlerStart,
		hasLoadingBoundary: hasActiveLoadingBoundary,
		omitPendingDynamicCacheState: hasRequestSearchParams,
		formState: options.formState ?? null,
		isProgressiveActionRender: options.isProgressiveActionRender === true,
		isDynamicError,
		isDraftMode,
		isForceDynamic,
		isForceStatic,
		isEdgeRuntime: options.isEdgeRuntime === true,
		isPrerender,
		isSpeculativePrerender,
		isProduction: options.isProduction,
		isRscRequest: options.isRscRequest,
		isrDebug: options.isrDebug,
		isrHtmlKey: options.isrHtmlKey,
		isrRscKey: options.isrRscKey,
		isrSet: options.isrSet,
		interceptionContext: options.interceptionContext,
		expireSeconds: options.expireSeconds,
		layoutCount: route.layouts.length,
		loadSsrHandler: options.loadSsrHandler,
		middlewareContext: options.middlewareContext,
		navigationParams,
		params: options.params,
		pprFallbackShellSignal,
		pprFallbackShellReactSignal,
		renderedPathAndSearch: options.renderedPathAndSearch,
		abortPprFallbackShell: activeFallbackShellState ? () => {
			options.pprRuntime.beginFinalRender(activeFallbackShellState);
		} : void 0,
		layoutParamAccess,
		rootParams: options.rootParams,
		peekRenderObservationState() {
			return {
				dynamicFetches: peekDynamicFetchObservations(),
				requestApis: peekRenderRequestApiUsage()
			};
		},
		probeLayoutAt(layoutIndex) {
			return options.probeLayoutAt(layoutIndex, layoutParamAccess);
		},
		probePage() {
			return options.probePage(pageSearchParams);
		},
		probePageBeforeRender: options.isRscRequest,
		classification: {
			getLayoutId(index) {
				const treePosition = route.layoutTreePositions?.[index] ?? 0;
				return AppElementsWire.encodeLayoutId(createAppPageTreePath([...route.routeSegments], treePosition));
			},
			buildTimeClassifications: layoutClassifications.buildTimeClassifications,
			buildTimeReasons: layoutClassifications.buildTimeReasons,
			debugClassification: options.debugClassification,
			isLayoutObservationDynamic(layoutId) {
				return isAppLayoutObservationUnsafeForStaticReuse(layoutParamAccess.getLayoutObservation(layoutId));
			},
			async runWithIsolatedDynamicScope(fn) {
				return runWithIsolatedDynamicUsage(fn);
			}
		},
		dynamicStaleTimeSeconds: options.dynamicStaleTimeSeconds,
		revalidateSeconds: currentRevalidateSeconds,
		mountedSlotsHeader: options.mountedSlotsHeader,
		renderMode: options.renderMode ?? "navigation",
		renderErrorBoundaryResponse(renderError, errorOrigin) {
			return options.renderErrorBoundaryPage(renderError, errorOrigin);
		},
		renderLayoutSpecialError(specialError, layoutIndex) {
			return renderLayoutSpecialError(options, specialError, layoutIndex, serveStreamingMetadata);
		},
		renderPageSpecialError(specialError) {
			return renderPageSpecialError(options, specialError, serveStreamingMetadata, interceptResult.interceptOpts);
		},
		renderToReadableStream: options.renderToReadableStream,
		hasCustomGlobalError: options.hasCustomGlobalError,
		prerenderToReadableStream: options.prerenderToReadableStream,
		routePattern: route.pattern,
		runWithSuppressedHookWarning(probe) {
			return options.runWithSuppressedHookWarning(probe);
		},
		scriptNonce: options.scriptNonce,
		waitUntil(cachePromise) {
			getRequestExecutionContext()?.waitUntil(cachePromise);
		}
	});
}
async function renderLayoutSpecialError(options, specialError, layoutIndex, serveStreamingMetadata) {
	return buildAppPageSpecialErrorResponse({
		basePath: options.basePath,
		buildRscRedirectFlightStream: (rscOptions) => buildRscRedirectFlightStream({
			renderToReadableStream: options.renderToReadableStream,
			digest: rscOptions.digest
		}),
		clearRequestContext: options.clearRequestContext,
		getAndClearPendingCookies,
		serveStreamingMetadata,
		isEdgeRuntime: options.isEdgeRuntime,
		isRscRequest: options.isRscRequest,
		middlewareContext: options.middlewareContext,
		renderFallbackPage(statusCode) {
			const parentBoundaryModule = resolveAppPageParentHttpAccessBoundaryModule({
				layoutIndex,
				rootForbiddenModule: options.rootForbiddenModule,
				rootNotFoundModule: options.rootNotFoundModule,
				rootUnauthorizedModule: options.rootUnauthorizedModule,
				routeForbiddenModules: options.route.forbiddens,
				routeNotFoundModules: options.route.notFounds,
				routeUnauthorizedModules: options.route.unauthorizeds,
				statusCode
			});
			const fallbackOptions = {
				layouts: options.route.layouts.slice(0, layoutIndex),
				matchedParams: options.params
			};
			if (parentBoundaryModule) {
				fallbackOptions.boundaryComponent = parentBoundaryModule.default;
				fallbackOptions.boundaryModule = parentBoundaryModule;
			}
			return options.renderHttpAccessFallbackPage(statusCode, fallbackOptions, null);
		},
		request: options.request,
		specialError
	});
}
async function renderPageSpecialError(options, specialError, serveStreamingMetadata, intercept) {
	return buildAppPageSpecialErrorResponse({
		basePath: options.basePath,
		buildRscRedirectFlightStream: (rscOptions) => buildRscRedirectFlightStream({
			renderToReadableStream: options.renderToReadableStream,
			digest: rscOptions.digest
		}),
		clearRequestContext: options.clearRequestContext,
		getAndClearPendingCookies,
		serveStreamingMetadata,
		isEdgeRuntime: options.isEdgeRuntime,
		isRscRequest: options.isRscRequest,
		middlewareContext: options.middlewareContext,
		renderFallbackPage(statusCode) {
			const routeBoundaryModule = resolveAppPageRouteBoundaryModule(options.route, statusCode);
			const layoutCount = options.route.layouts.length;
			const { module: parentBoundaryModule, layoutIndex: boundaryLayoutIndex } = resolveAppPageParentHttpAccessBoundary({
				layoutIndex: layoutCount,
				rootForbiddenModule: options.rootForbiddenModule,
				rootNotFoundModule: options.rootNotFoundModule,
				rootUnauthorizedModule: options.rootUnauthorizedModule,
				routeForbiddenModules: options.route.forbiddens,
				routeNotFoundModules: options.route.notFounds,
				routeUnauthorizedModules: options.route.unauthorizeds,
				statusCode
			});
			const useLayoutAlignedBoundary = boundaryLayoutIndex !== null && (routeBoundaryModule === null || routeBoundaryModule === parentBoundaryModule);
			const fallbackOptions = {
				intercept,
				matchedParams: options.params
			};
			if (useLayoutAlignedBoundary && boundaryLayoutIndex !== null) {
				fallbackOptions.layouts = options.route.layouts.slice(0, boundaryLayoutIndex + 1);
				if (parentBoundaryModule) {
					fallbackOptions.boundaryComponent = parentBoundaryModule.default;
					fallbackOptions.boundaryModule = parentBoundaryModule;
				}
			}
			return options.renderHttpAccessFallbackPage(statusCode, fallbackOptions, null);
		},
		request: options.request,
		specialError
	});
}
//#endregion
export { dispatchAppPage, hasSearchParams, shouldReadAppPageCache };
