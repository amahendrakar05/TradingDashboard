import { stripBasePath } from "../utils/base-path.js";
import { NEVER_CACHE_CONTROL } from "./cache-control.js";
import { AppElementsWire } from "./app-elements-wire.js";
import "./app-elements.js";
import DefaultGlobalError from "../shims/default-global-error.js";
import { isNavigationSignalError } from "../utils/navigation-signal.js";
import { ErrorBoundary, GlobalErrorBoundary, SerializedErrorBoundary } from "../shims/error-boundary.js";
import { LayoutSegmentProvider } from "../shims/layout-segment-context.js";
import { MetadataHead, ViewportHead } from "../shims/metadata.js";
import { resolveAppPageBranchParams, resolveAppPageSegmentParams } from "./app-page-params.js";
import { stripRscSuffix } from "./app-rsc-cache-busting.js";
import { buildRscRedirectFlightStream } from "./app-rsc-redirect-flight.js";
import { bufferAppPageBinaryStream, buildAppPageSpecialErrorResponse, resolveAppPageSpecialError } from "./app-page-execution.js";
import { resolveActiveParallelRouteHeadInputs, resolveAppPageHead } from "./app-page-head.js";
import { createAppPageLayoutEntries, createAppPageSourcePage } from "./app-page-route-wiring.js";
import { buildClientHookErrorMessage } from "../shims/client-hook-error.js";
import { resolveHttpAccessFallbackMetadata, resolveHttpAccessFallbackViewport } from "./app-page-http-access-fallback-metadata.js";
import "./app-rsc-route-matching.js";
import { renderAppPageBoundaryResponse, resolveAppPageErrorBoundary, resolveAppPageHttpAccessBoundaryModule, wrapAppPageBoundaryElement } from "./app-page-boundary.js";
import { resolveSlotParamOverrides } from "./app-page-element-builder.js";
import { createAppPageFontData, createAppPageRscErrorTracker, renderAppPageHtmlResponse } from "./app-page-stream.js";
import { Fragment, createElement } from "react";
//#region src/server/app-page-boundary-render.ts
const DEFAULT_GLOBAL_ERROR_COMPONENT = DefaultGlobalError;
function getDefaultExport(module) {
	return module?.default ?? null;
}
function resolveHttpAccessBoundaryTreePosition(route, boundaryModule, statusCode) {
	if (!route || !boundaryModule) return null;
	const routeBoundary = statusCode === 403 ? route.forbidden : statusCode === 401 ? route.unauthorized : route.notFound;
	const layoutBoundaries = statusCode === 403 ? route.forbiddens : statusCode === 401 ? route.unauthorizeds : route.notFounds;
	if (boundaryModule === routeBoundary && statusCode === 404) return route.notFoundTreePosition ?? null;
	if (boundaryModule === routeBoundary && statusCode === 403) return route.forbiddenTreePosition ?? null;
	if (boundaryModule === routeBoundary && statusCode === 401) return route.unauthorizedTreePosition ?? null;
	for (let index = (layoutBoundaries?.length ?? 0) - 1; index >= 0; index--) if (layoutBoundaries?.[index] === boundaryModule) return route.layoutTreePositions?.[index] ?? null;
	return null;
}
function wrapRenderedBoundaryElement(options) {
	return wrapAppPageBoundaryElement({
		element: options.element,
		getDefaultExport,
		globalErrorComponent: getDefaultExport(options.globalErrorModule),
		includeGlobalErrorBoundary: options.includeGlobalErrorBoundary,
		isRscRequest: options.isRscRequest,
		layoutModules: options.layoutModules,
		layoutTreePositions: options.layoutTreePositions,
		makeThenableParams: options.makeThenableParams,
		matchedParams: options.matchedParams,
		renderErrorBoundary(GlobalErrorComponent, children) {
			return createElement(GlobalErrorBoundary, {
				fallback: DEFAULT_GLOBAL_ERROR_COMPONENT,
				children: createElement(ErrorBoundary, {
					fallback: GlobalErrorComponent,
					children
				})
			});
		},
		renderLayout(LayoutComponent, children, asyncParams) {
			return createElement(LayoutComponent, {
				children,
				params: asyncParams
			});
		},
		renderLayoutSegmentProvider(segmentMap, children) {
			return createElement(LayoutSegmentProvider, { segmentMap }, children);
		},
		resolveChildSegments: options.resolveChildSegments,
		routeSegments: options.routeSegments ?? [],
		skipLayoutWrapping: options.skipLayoutWrapping
	});
}
function createAppPageBoundaryLayoutEntries(route, layoutModules) {
	if (!route || layoutModules.length === 0) return [];
	return createAppPageLayoutEntries({
		errors: route.errors,
		layoutTreePositions: route.layoutTreePositions,
		layouts: layoutModules,
		notFounds: null,
		routeSegments: route.routeSegments
	});
}
function resolveHttpAccessFallbackHeadRouteSegments(route, layoutModules) {
	if (!route?.routeSegments) return;
	if (!route.layouts || layoutModules.length >= route.layouts.length) return route.routeSegments;
	const lastIncludedLayoutIndex = layoutModules.length - 1;
	if (lastIncludedLayoutIndex < 0) return [];
	const segmentCount = route.layoutTreePositions?.[lastIncludedLayoutIndex] ?? 0;
	return route.routeSegments.slice(0, segmentCount);
}
function resolveHttpAccessFallbackHeadLayoutTreePositions(route, layoutModules) {
	if (!route?.layouts || layoutModules.length >= route.layouts.length) return route?.layoutTreePositions;
	return route.layoutTreePositions?.slice(0, layoutModules.length);
}
function createAppPageBoundaryRscPayload(options) {
	const routeId = AppElementsWire.encodeRouteId(options.pathname, null);
	const layoutEntries = createAppPageBoundaryLayoutEntries(options.route, options.layoutModules);
	const sourcePageSegments = options.sourcePageSegments ?? options.route?.routeSegments;
	return {
		...AppElementsWire.createMetadataEntries({
			interceptionContext: null,
			layoutIds: layoutEntries.map((entry) => entry.id),
			rootLayoutTreePath: layoutEntries[0]?.treePath ?? null,
			routeId,
			sourcePage: sourcePageSegments ? createAppPageSourcePage(sourcePageSegments) : null
		}),
		[routeId]: options.element
	};
}
function renderBoundarySpecialErrorResponse(options, specialError) {
	return buildAppPageSpecialErrorResponse({
		basePath: options.basePath,
		buildRscRedirectFlightStream: (rscOptions) => buildRscRedirectFlightStream({
			renderToReadableStream: options.renderToReadableStream,
			digest: rscOptions.digest
		}),
		clearRequestContext: options.clearRequestContext,
		getAndClearPendingCookies: options.getAndClearPendingCookies,
		isEdgeRuntime: options.isEdgeRuntime,
		isRscRequest: options.isRscRequest,
		middlewareContext: options.middlewareContext,
		serveStreamingMetadata: options.serveStreamingMetadata,
		request: options.request,
		specialError
	});
}
async function renderAppPageBoundaryElementResponse(options) {
	const requestUrl = new URL(options.requestUrl);
	const pathname = requestUrl.pathname;
	const payload = createAppPageBoundaryRscPayload({
		element: options.element,
		layoutModules: options.layoutModules,
		pathname,
		route: options.route,
		sourcePageSegments: options.sourcePageSegments
	});
	const rscErrorTracker = createAppPageRscErrorTracker(options.createRscOnErrorHandler(pathname, options.routePattern ?? pathname));
	const resolveCapturedSpecialError = (error) => resolveAppPageSpecialError(error) ?? resolveAppPageSpecialError(rscErrorTracker.getCapturedSpecialError());
	const renderSpecialErrorResponse = (specialError) => renderBoundarySpecialErrorResponse(options, specialError);
	const handleSpecialErrors = options.handleSpecialErrors === true;
	let response;
	try {
		response = await renderAppPageBoundaryResponse({
			async createHtmlResponse(rscStream, responseStatus) {
				const fontData = createAppPageFontData({
					getLinks: options.getFontLinks,
					getPreloads: options.getFontPreloads,
					getStyles: options.getFontStyles
				});
				const ssrHandler = await options.loadSsrHandler();
				return renderAppPageHtmlResponse({
					clearRequestContext: options.clearRequestContext,
					fontData,
					fontLinkHeader: options.buildFontLinkHeader(fontData.preloads),
					isEdgeRuntime: options.isEdgeRuntime,
					middlewareHeaders: options.middlewareContext.headers,
					navigationContext: options.getNavigationContext() ?? {
						pathname,
						searchParams: requestUrl.searchParams,
						params: options.navigationParams ?? options.route?.params ?? {}
					},
					rscStream,
					scriptNonce: options.scriptNonce,
					ssrHandler,
					status: responseStatus,
					initialDevServerError: options.initialDevServerError
				});
			},
			createRscOnErrorHandler() {
				return rscErrorTracker.onRenderError;
			},
			element: payload,
			isEdgeRuntime: options.isEdgeRuntime,
			isRscRequest: options.isRscRequest,
			middlewareHeaders: options.middlewareContext.headers,
			renderToReadableStream: options.renderToReadableStream,
			status: options.status
		});
	} catch (error) {
		const specialError = handleSpecialErrors ? resolveCapturedSpecialError(error) : null;
		if (specialError !== null) return renderSpecialErrorResponse(specialError);
		throw error;
	}
	if (!handleSpecialErrors) return response;
	if (options.isRscRequest && response.body) {
		const bufferedStream = await bufferAppPageBinaryStream(response.body);
		response = new Response(bufferedStream, {
			status: response.status,
			headers: response.headers
		});
	}
	const specialError = resolveCapturedSpecialError();
	if (!specialError) return response;
	if (response.body) try {
		await response.body.cancel();
	} catch {}
	return renderSpecialErrorResponse(specialError);
}
async function renderAppPageHttpAccessFallback(options) {
	const resolvedBoundaryModule = resolveAppPageHttpAccessBoundaryModule({
		rootForbiddenModule: options.rootForbiddenModule,
		rootNotFoundModule: options.rootNotFoundModule,
		rootUnauthorizedModule: options.rootUnauthorizedModule,
		routeForbiddenModule: options.route?.forbidden,
		routeNotFoundModule: options.route?.notFound,
		routeUnauthorizedModule: options.route?.unauthorized,
		statusCode: options.statusCode
	});
	const boundaryModule = options.boundaryModule ?? resolvedBoundaryModule;
	const boundaryComponent = options.boundaryComponent ?? getDefaultExport(boundaryModule);
	if (!boundaryComponent) return null;
	const layoutModules = options.layoutModules ?? options.route?.layouts ?? options.rootLayouts;
	const pathname = new URL(options.requestUrl).pathname;
	const routePathname = options.routePathname ?? stripRscSuffix(stripBasePath(pathname, options.basePath ?? ""));
	const routeSegments = resolveHttpAccessFallbackHeadRouteSegments(options.route, layoutModules);
	const fallbackRouteSegments = routeSegments ?? [];
	let head;
	try {
		if ([
			401,
			403,
			404
		].includes(options.statusCode)) {
			const boundaryTreePosition = resolveHttpAccessBoundaryTreePosition(options.route, boundaryModule, options.statusCode);
			const boundaryParams = boundaryTreePosition == null ? {} : resolveAppPageSegmentParams(fallbackRouteSegments, boundaryTreePosition, options.matchedParams);
			const intercept = options.intercept;
			const isSiblingIntercept = intercept?.interceptSlotKey === "__vinext_page_intercept" && intercept.interceptPage != null;
			const effectiveParams = isSiblingIntercept ? intercept.interceptParams ?? options.matchedParams : options.matchedParams;
			const slotParams = resolveSlotParamOverrides({ slots: options.route?.slots ?? null }, routePathname);
			const parallelBranches = resolveActiveParallelRouteHeadInputs({
				interceptBranchSegments: intercept?.interceptBranchSegments ?? null,
				interceptLayouts: intercept?.interceptLayouts ?? null,
				interceptLayoutSegments: intercept?.interceptLayoutSegments ?? null,
				interceptNotFoundBranchSegments: intercept?.interceptNotFoundBranchSegments ?? null,
				interceptNotFound: intercept?.interceptNotFound ?? null,
				interceptNotFoundTreePosition: intercept?.interceptNotFoundTreePosition ?? null,
				interceptPage: intercept?.interceptPage ?? null,
				interceptParams: intercept?.interceptParams ?? null,
				interceptSlotKey: intercept?.interceptSlotKey ?? null,
				interceptSourcePageSegments: intercept?.interceptSourcePageSegments ?? null,
				layoutTreePositions: options.route?.layoutTreePositions,
				params: options.matchedParams,
				routeSegments: fallbackRouteSegments,
				slotParams,
				slots: options.route?.slots ?? null
			});
			const primaryParallelBranch = isSiblingIntercept ? {
				head: {
					layoutModules: intercept?.interceptLayouts ?? [],
					layoutParams: (intercept?.interceptLayoutSegments ?? []).map((segments) => resolveAppPageBranchParams(intercept?.interceptBranchSegments ?? segments, segments.length, effectiveParams, segments)),
					pageModule: intercept?.interceptPage ?? null,
					params: effectiveParams,
					routeSegments: intercept?.interceptSourcePageSegments ?? fallbackRouteSegments
				},
				...intercept?.interceptNotFound ? {
					notFoundModule: intercept.interceptNotFound,
					notFoundParams: resolveAppPageBranchParams(intercept.interceptNotFoundBranchSegments ?? intercept.interceptBranchSegments ?? fallbackRouteSegments, intercept.interceptNotFoundTreePosition ?? 0, effectiveParams)
				} : {},
				ownerTreePosition: fallbackRouteSegments.length
			} : null;
			const fallbackHeadOptions = {
				boundaryModule,
				boundaryParams,
				branchNotFoundConventions: options.statusCode === 404,
				layoutModules,
				layoutTreePositions: resolveHttpAccessFallbackHeadLayoutTreePositions(options.route, layoutModules),
				parallelBranches,
				params: options.matchedParams,
				primaryParallelBranch,
				routeSegments
			};
			const [metadata, viewport] = await Promise.all([resolveHttpAccessFallbackMetadata({
				applyFileBasedMetadata: options.applyFileBasedMetadata,
				basePath: options.basePath ?? "",
				...fallbackHeadOptions,
				metadataRoutes: options.metadataRoutes,
				routePath: options.route?.pattern ?? pathname
			}), resolveHttpAccessFallbackViewport(fallbackHeadOptions)]);
			head = {
				metadata,
				viewport
			};
		} else head = await resolveAppPageHead({
			applyFileBasedMetadata: options.applyFileBasedMetadata,
			basePath: options.basePath ?? "",
			layoutModules,
			layoutTreePositions: resolveHttpAccessFallbackHeadLayoutTreePositions(options.route, layoutModules),
			metadataRoutes: options.metadataRoutes,
			pageModule: boundaryModule,
			params: options.matchedParams,
			routePath: options.route?.pattern ?? pathname,
			routeSegments
		});
	} catch (error) {
		const specialError = resolveAppPageSpecialError(error);
		if (specialError) return renderBoundarySpecialErrorResponse(options, specialError);
		throw error;
	}
	const { metadata, viewport } = head;
	const headElements = [createElement("meta", {
		charSet: "utf-8",
		key: "charset"
	}), createElement("meta", {
		key: "robots",
		name: "robots",
		content: "noindex"
	})];
	if (metadata) headElements.push(createElement(MetadataHead, {
		key: "metadata",
		metadata,
		pathname,
		trailingSlash: options.trailingSlash
	}));
	headElements.push(createElement(ViewportHead, {
		key: "viewport",
		viewport
	}));
	const skipLayoutWrapping = options.skipLayoutWrapping ?? false;
	const element = wrapRenderedBoundaryElement({
		element: createElement(Fragment, null, ...headElements, createElement(boundaryComponent)),
		globalErrorModule: options.globalErrorModule,
		includeGlobalErrorBoundary: true,
		isRscRequest: options.isRscRequest,
		layoutModules,
		layoutTreePositions: options.route?.layoutTreePositions,
		makeThenableParams: options.makeThenableParams,
		matchedParams: options.matchedParams,
		resolveChildSegments: options.resolveChildSegments,
		routeSegments: options.route?.routeSegments,
		skipLayoutWrapping
	});
	return renderAppPageBoundaryElementResponse({
		...options,
		element,
		handleSpecialErrors: true,
		layoutModules: skipLayoutWrapping ? [] : layoutModules,
		navigationParams: options.matchedParams,
		route: skipLayoutWrapping ? null : options.route,
		routePattern: options.route?.pattern,
		status: options.statusCode
	});
}
async function renderAppPageErrorBoundary(options) {
	const errorBoundary = resolveAppPageErrorBoundary({
		getDefaultExport,
		errorModules: options.route?.errorPaths,
		globalErrorModule: options.globalErrorModule,
		layoutErrorModules: options.route?.errors,
		pageErrorModule: options.route?.error
	});
	if (!errorBoundary.component) return null;
	const rawError = options.error instanceof Error ? options.error : new Error(String(options.error));
	rewriteClientHookError(rawError);
	const errorObject = options.errorOrigin === "ssr" ? rawError : options.sanitizeErrorForClient(rawError);
	const matchedParams = options.matchedParams ?? options.route?.params ?? {};
	const layoutModules = options.route?.layouts ?? options.rootLayouts;
	const pathname = new URL(options.requestUrl).pathname;
	const headElements = [createElement("meta", {
		charSet: "utf-8",
		key: "charset"
	})];
	if (!errorBoundary.isGlobalError) try {
		const { metadata, viewport } = await resolveAppPageHead({
			applyFileBasedMetadata: options.applyFileBasedMetadata,
			basePath: options.basePath ?? "",
			fallbackOnFileMetadataError: true,
			layoutModules,
			layoutTreePositions: options.route?.layoutTreePositions,
			metadataRoutes: options.metadataRoutes,
			params: matchedParams,
			routePath: options.route?.pattern ?? pathname,
			routeSegments: options.route?.routeSegments
		});
		if (metadata) headElements.push(createElement(MetadataHead, {
			key: "metadata",
			metadata,
			pathname,
			trailingSlash: options.trailingSlash
		}));
		headElements.push(createElement(ViewportHead, {
			key: "viewport",
			viewport
		}));
	} catch (error) {
		console.error(`[vinext] App page error boundary head resolution failed for ${options.route?.pattern ?? pathname}:`, error);
	}
	const buildElement = (BoundaryComponent) => {
		const serializedError = {
			digest: "digest" in errorObject ? String(errorObject.digest) : void 0,
			message: errorObject.message,
			name: errorObject.name,
			stack: process.env.NODE_ENV !== "production" ? errorObject.stack : void 0
		};
		const boundaryElement = errorBoundary.isGlobalError && BoundaryComponent !== DEFAULT_GLOBAL_ERROR_COMPONENT ? createElement(SerializedErrorBoundary, {
			error: serializedError,
			fallback: BoundaryComponent
		}) : createElement(BoundaryComponent, { error: errorObject });
		return wrapRenderedBoundaryElement({
			element: createElement(Fragment, null, ...headElements, errorBoundary.isGlobalError ? createElement(GlobalErrorBoundary, {
				fallback: DEFAULT_GLOBAL_ERROR_COMPONENT,
				children: boundaryElement
			}) : boundaryElement),
			globalErrorModule: options.globalErrorModule,
			includeGlobalErrorBoundary: !errorBoundary.isGlobalError,
			isRscRequest: options.isRscRequest,
			layoutModules,
			layoutTreePositions: options.route?.layoutTreePositions,
			makeThenableParams: options.makeThenableParams,
			matchedParams,
			resolveChildSegments: options.resolveChildSegments,
			routeSegments: options.route?.routeSegments,
			skipLayoutWrapping: errorBoundary.isGlobalError
		});
	};
	const renderWith = async (BoundaryComponent) => {
		const response = await renderAppPageBoundaryElementResponse({
			...options,
			element: buildElement(BoundaryComponent),
			initialDevServerError: rawError,
			layoutModules,
			navigationParams: matchedParams,
			route: options.route,
			routePattern: options.route?.pattern,
			status: errorBoundary.isGlobalError ? 500 : 200
		});
		if (errorBoundary.isGlobalError) {
			response.headers.set("Cache-Control", NEVER_CACHE_CONTROL);
			response.headers.delete("CDN-Cache-Control");
			response.headers.delete("Cloudflare-CDN-Cache-Control");
			response.headers.delete("Cache-Tag");
		}
		return response;
	};
	try {
		return await renderWith(errorBoundary.component);
	} catch (renderError) {
		if (errorBoundary.isGlobalError && !isNavigationSignalError(renderError) && !resolveAppPageSpecialError(renderError)) {
			console.error(`[vinext] global-error.tsx threw while rendering for ${options.route?.pattern ?? pathname}; falling back to the built-in default global-error:`, renderError);
			return renderWith(DEFAULT_GLOBAL_ERROR_COMPONENT);
		}
		throw renderError;
	}
}
const _clientHookPattern = /\b(useState|useEffect|useReducer|useRef|useContext|useLayoutEffect|useInsertionEffect|useSyncExternalStore|useTransition|useImperativeHandle|useDeferredValue|useActionState|useOptimistic|useEffectEvent)\b.*is not a function/;
function rewriteClientHookError(error) {
	const match = error.message.match(_clientHookPattern);
	if (match) error.message = buildClientHookErrorMessage(`${match[1]}()`);
}
//#endregion
export { renderAppPageErrorBoundary, renderAppPageHttpAccessFallback };
