import { DEFAULT_GLOBAL_ERROR_MODULE } from "./default-global-error-module.js";
import { shouldServeStreamingMetadata } from "./streaming-metadata.js";
import { renderAppPageErrorBoundary, renderAppPageHttpAccessFallback } from "./app-page-boundary-render.js";
import { DEFAULT_GLOBAL_NOT_FOUND_MODULE } from "./default-global-not-found-module.js";
import { DEFAULT_NOT_FOUND_MODULE } from "./default-not-found-module.js";
//#region src/server/app-fallback-renderer.ts
const EMPTY_MW_CTX = {
	headers: null,
	status: null
};
function createAppFallbackRenderer(options) {
	const { applyFileBasedMetadata, basePath = "", htmlLimitedBots, clearRequestContext, createRscOnErrorHandler: buildRscOnErrorHandler, fontProviders, getAndClearPendingCookies, getNavigationContext, globalErrorModule, globalNotFoundEnabled = false, loadGlobalNotFoundModule, makeThenableParams, metadataRoutes, resolveChildSegments, rootBoundaries, rscRenderer, sanitizer, ssrLoader, trailingSlash } = options;
	const { rootForbiddenModule, rootLayouts, rootNotFoundModule, rootUnauthorizedModule } = rootBoundaries;
	const effectiveGlobalErrorModule = globalErrorModule ?? DEFAULT_GLOBAL_ERROR_MODULE;
	const effectiveRootNotFoundModule = rootNotFoundModule ?? DEFAULT_NOT_FOUND_MODULE;
	let globalNotFoundModulePromise = null;
	function resolveGlobalNotFoundModule() {
		if (!loadGlobalNotFoundModule) return null;
		if (globalNotFoundModulePromise === null) globalNotFoundModulePromise = Promise.resolve().then(loadGlobalNotFoundModule);
		return globalNotFoundModulePromise;
	}
	return {
		async renderHttpAccessFallback(route, statusCode, isRscRequest, request, opts, scriptNonce, middlewareContext, callContext) {
			const serveStreamingMetadata = shouldServeStreamingMetadata(request.headers.get("user-agent") ?? "", htmlLimitedBots);
			const useGlobalNotFound = statusCode === 404 && globalNotFoundEnabled && !route && !opts?.boundaryComponent;
			if (useGlobalNotFound && loadGlobalNotFoundModule) {
				const globalNotFoundModule = await resolveGlobalNotFoundModule();
				const globalNotFoundComponent = globalNotFoundModule?.default ?? null;
				if (globalNotFoundComponent) return renderAppPageHttpAccessFallback({
					applyFileBasedMetadata,
					basePath,
					trailingSlash,
					boundaryComponent: globalNotFoundComponent,
					boundaryModule: globalNotFoundModule ?? null,
					buildFontLinkHeader: fontProviders.buildFontLinkHeader,
					clearRequestContext,
					createRscOnErrorHandler(pathname, routePath) {
						return buildRscOnErrorHandler(request, pathname, routePath);
					},
					getFontLinks: fontProviders.getFontLinks,
					getFontPreloads: fontProviders.getFontPreloads,
					getFontStyles: fontProviders.getFontStyles,
					getAndClearPendingCookies,
					getNavigationContext,
					globalErrorModule: effectiveGlobalErrorModule,
					isEdgeRuntime: callContext?.isEdgeRuntime,
					isRscRequest,
					layoutModules: [],
					loadSsrHandler: ssrLoader,
					makeThenableParams,
					matchedParams: opts?.matchedParams ?? {},
					middlewareContext: middlewareContext ?? EMPTY_MW_CTX,
					metadataRoutes,
					request,
					requestUrl: request.url,
					resolveChildSegments,
					rootForbiddenModule: null,
					rootLayouts: [],
					rootNotFoundModule: null,
					rootUnauthorizedModule: null,
					route: null,
					renderToReadableStream: rscRenderer,
					scriptNonce,
					serveStreamingMetadata,
					skipLayoutWrapping: true,
					statusCode
				});
			}
			const routeMissRootNotFoundModule = useGlobalNotFound ? DEFAULT_GLOBAL_NOT_FOUND_MODULE : effectiveRootNotFoundModule;
			return renderAppPageHttpAccessFallback({
				applyFileBasedMetadata,
				basePath,
				trailingSlash,
				boundaryComponent: opts?.boundaryComponent ?? null,
				boundaryModule: opts?.boundaryModule ?? null,
				buildFontLinkHeader: fontProviders.buildFontLinkHeader,
				clearRequestContext,
				createRscOnErrorHandler(pathname, routePath) {
					return buildRscOnErrorHandler(request, pathname, routePath);
				},
				getFontLinks: fontProviders.getFontLinks,
				getFontPreloads: fontProviders.getFontPreloads,
				getFontStyles: fontProviders.getFontStyles,
				getAndClearPendingCookies,
				getNavigationContext,
				globalErrorModule: effectiveGlobalErrorModule,
				intercept: opts?.intercept ?? null,
				isEdgeRuntime: callContext?.isEdgeRuntime,
				isRscRequest,
				layoutModules: useGlobalNotFound ? [] : opts?.layouts ?? null,
				loadSsrHandler: ssrLoader,
				makeThenableParams,
				matchedParams: opts?.matchedParams ?? route?.params ?? {},
				middlewareContext: middlewareContext ?? EMPTY_MW_CTX,
				metadataRoutes,
				request,
				requestUrl: request.url,
				resolveChildSegments,
				rootForbiddenModule,
				rootLayouts: useGlobalNotFound ? [] : rootLayouts,
				rootNotFoundModule: routeMissRootNotFoundModule,
				rootUnauthorizedModule,
				route: useGlobalNotFound ? null : route,
				routePathname: callContext?.routePathname,
				renderToReadableStream: rscRenderer,
				scriptNonce,
				serveStreamingMetadata,
				skipLayoutWrapping: useGlobalNotFound,
				sourcePageSegments: callContext?.sourcePageSegments,
				statusCode
			});
		},
		renderNotFound(route, isRscRequest, request, matchedParams, scriptNonce, middlewareContext, callContext) {
			return this.renderHttpAccessFallback(route, 404, isRscRequest, request, { matchedParams }, scriptNonce, middlewareContext, callContext);
		},
		renderErrorBoundary(route, error, isRscRequest, request, matchedParams, scriptNonce, middlewareContext, callContext, errorOrigin = "rsc") {
			return renderAppPageErrorBoundary({
				applyFileBasedMetadata,
				basePath,
				trailingSlash,
				buildFontLinkHeader: fontProviders.buildFontLinkHeader,
				clearRequestContext,
				createRscOnErrorHandler(pathname, routePath) {
					return buildRscOnErrorHandler(request, pathname, routePath);
				},
				error,
				errorOrigin,
				getFontLinks: fontProviders.getFontLinks,
				getFontPreloads: fontProviders.getFontPreloads,
				getFontStyles: fontProviders.getFontStyles,
				getAndClearPendingCookies,
				getNavigationContext,
				globalErrorModule: effectiveGlobalErrorModule,
				isEdgeRuntime: callContext?.isEdgeRuntime,
				isRscRequest,
				loadSsrHandler: ssrLoader,
				makeThenableParams,
				matchedParams: matchedParams ?? route?.params ?? {},
				middlewareContext: middlewareContext ?? EMPTY_MW_CTX,
				metadataRoutes,
				request,
				requestUrl: request.url,
				resolveChildSegments,
				rootLayouts,
				route,
				renderToReadableStream: rscRenderer,
				sanitizeErrorForClient: sanitizer,
				scriptNonce,
				sourcePageSegments: callContext?.sourcePageSegments
			});
		}
	};
}
//#endregion
export { createAppFallbackRenderer };
