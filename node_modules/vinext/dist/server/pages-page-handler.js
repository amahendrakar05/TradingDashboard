import { createRequestContext, runWithRequestContext } from "../shims/unified-request-context.js";
import { patternToNextFormat } from "../routing/route-validation.js";
import { getRequestExecutionContext } from "../shims/request-context.js";
import { NEXTJS_DEPLOYMENT_ID_HEADER } from "./headers.js";
import { reportRequestError } from "./instrumentation.js";
import { BROWSER_REVALIDATE_CACHE_CONTROL, NEVER_CACHE_CONTROL, applyCdnResponseHeaders, shouldUseNextDeployCacheControl } from "./cache-control.js";
import { buildMissIsrCacheControl } from "./isr-decision.js";
import { PRERENDER_REVALIDATE_HEADER, isOnDemandRevalidateRequest, isrCacheKey, isrGet, isrSet, triggerBackgroundRegeneration } from "./isr-cache.js";
import { ensureFetchPatch } from "../shims/fetch-cache.js";
import { appendAssetDeploymentIdQuery } from "../utils/deployment-id.js";
import { mergeRouteParamsIntoQuery, parseQueryString } from "../utils/query.js";
import { getScriptNonceFromHeaderSources } from "./csp.js";
import { extractLocaleFromUrl, resolvePagesI18nRequest } from "./pages-i18n.js";
import { buildDefaultPagesNotFoundResponse } from "./pages-default-404.js";
import { buildPagesReadinessNextData } from "./pages-readiness.js";
import { resolvePagesPageMethodResponse } from "./pages-page-method.js";
import { renderPagesPageResponse } from "./pages-page-response.js";
import { hasPagesGetInitialProps } from "./pages-get-initial-props.js";
import { buildNextDataNotFoundResponse, buildNextDataPropsJsonResponse, normalizePagesDataRequest, parseNextDataPathname } from "./pages-data-route.js";
import { resolvePagesPageData } from "./pages-page-data.js";
import { collectAssetTags, resolveClientModuleUrl } from "./pages-asset-tags.js";
import { PAGES_PREVIEW_CACHE_CONTROL, appendPagesPreviewClearCookies, getPagesPreviewState } from "./pages-preview.js";
import { createPagesReqRes } from "./pages-node-compat.js";
//#region src/server/pages-page-handler.ts
function finalizePagesPreviewResponse(response, preview) {
	if (preview.data === false && !preview.shouldClear) return response;
	const headers = new Headers(response.headers);
	if (preview.data !== false) headers.set("Cache-Control", PAGES_PREVIEW_CACHE_CONTROL);
	if (preview.shouldClear) appendPagesPreviewClearCookies(headers);
	return new Response(response.body, {
		headers,
		status: response.status,
		statusText: response.statusText
	});
}
function shouldEmitPagesClientTraceMetadata(pageModule, appComponent) {
	if (typeof pageModule.getServerSideProps === "function") return true;
	if (typeof pageModule.getStaticProps === "function") return false;
	return hasPagesGetInitialProps(pageModule.default) || hasPagesGetInitialProps(appComponent);
}
function buildI18nRenderContext(i18nConfig, locale, currentDefaultLocale, domainLocales) {
	return {
		locale,
		locales: i18nConfig ? i18nConfig.locales : void 0,
		defaultLocale: currentDefaultLocale,
		domainLocales
	};
}
/**
* Create the Pages Router render function (`_renderPage`).
*
* The returned function is self-recursive for 404/500 fallback renders and
* accepts the same options shape the generated entry always passed inline.
*/
function createPagesPageHandler(opts) {
	const { pageRoutes, errorPageRoute, matchRoute, i18nConfig, vinextConfig, buildId, hasMiddleware, appAssetPath, hasRewrites, setSSRContext, getPagesNavigationIsReadyFromSerializedState, setI18nContext, wrapWithRouterContext, router, resetSSRHead, getSSRHeadHTML, setDocumentInitialHead, flushPreloads, getFontLinks, getFontStyles, getFontPreloads, renderToReadableStream, renderIsrPassToStringAsync, safeJsonStringify, sanitizeDestination, createPageElement, enhancePageElement, AppComponent, DocumentComponent } = opts;
	function renderToStringAsync(element) {
		return renderToReadableStream(element).then((stream) => new Response(stream).text());
	}
	function findNotFoundRoute() {
		for (let i = 0; i < pageRoutes.length; i++) if (pageRoutes[i].pattern === "/404") return pageRoutes[i];
		return errorPageRoute;
	}
	function isrCacheKeyForRequest(i18nCacheVariant) {
		if (!i18nCacheVariant) return (router, pathname) => isrCacheKey(router, pathname, buildId ?? void 0);
		return (router, pathname) => isrCacheKey(router, pathname + "::i18n=" + encodeURIComponent(i18nCacheVariant), buildId ?? void 0);
	}
	async function renderPage(request, url, manifest, middlewareHeaders, options) {
		let isDataReq = !!(options && options.isDataReq);
		const requestUrl = new URL(request.url);
		const rawOriginalUrl = options && typeof options.originalUrl === "string" ? options.originalUrl : requestUrl.pathname + requestUrl.search;
		const originalRequestUrl = new URL(rawOriginalUrl, requestUrl);
		const originalRequestPathAndSearch = originalRequestUrl.pathname + originalRequestUrl.search;
		let dataRequestPathname = null;
		let dataRequestSearch = "";
		const initialDataNorm = normalizePagesDataRequest(request, buildId, vinextConfig.basePath, hasMiddleware && vinextConfig.trailingSlash);
		if (!isDataReq) {
			if (initialDataNorm.notFoundResponse) return initialDataNorm.notFoundResponse;
			if (initialDataNorm.isDataReq) {
				isDataReq = true;
				dataRequestPathname = initialDataNorm.normalizedPathname;
				dataRequestSearch = initialDataNorm.search;
				if (url && url.startsWith("/_next/data/")) {
					const qs = url.includes("?") ? url.slice(url.indexOf("?")) : "";
					url = initialDataNorm.normalizedPathname + qs;
				}
			}
		} else if (initialDataNorm.isDataReq) {
			dataRequestPathname = initialDataNorm.normalizedPathname;
			dataRequestSearch = initialDataNorm.search;
		}
		if (isDataReq && dataRequestPathname === null && buildId) {
			const originalDataMatch = parseNextDataPathname(originalRequestUrl.pathname, buildId);
			if (originalDataMatch) {
				dataRequestPathname = originalDataMatch.pagePathname;
				dataRequestSearch = originalRequestUrl.search;
			}
		}
		const statusCode = options && typeof options.statusCode === "number" ? options.statusCode : void 0;
		const defaultAsPath = isDataReq && dataRequestPathname ? dataRequestPathname + dataRequestSearch : originalRequestPathAndSearch;
		const asPath = options && typeof options.asPath === "string" ? options.asPath : defaultAsPath;
		const renderErrorPageOnMiss = !(options && options.renderErrorPageOnMiss === false);
		const isInternalErrorRender = !!(options && options.__isInternalErrorRender);
		const err = options && options.err;
		const localeInfo = i18nConfig ? resolvePagesI18nRequest(url, i18nConfig, request.headers, new URL(request.url).hostname, vinextConfig.basePath, vinextConfig.trailingSlash) : {
			locale: void 0,
			url,
			hadPrefix: false,
			domainLocale: void 0,
			redirectUrl: void 0
		};
		const locale = localeInfo.locale;
		const routeUrl = localeInfo.url;
		const currentDefaultLocale = i18nConfig ? localeInfo.domainLocale ? localeInfo.domainLocale.defaultLocale : i18nConfig.defaultLocale : void 0;
		const domainLocales = i18nConfig ? i18nConfig.domains : void 0;
		const pageIsrCacheKey = isrCacheKeyForRequest(i18nConfig ? localeInfo.domainLocale ? "domain:" + String(localeInfo.domainLocale.domain).toLowerCase() : "locale:" + String(locale) : null);
		if (localeInfo.redirectUrl) return new Response(null, {
			status: 307,
			headers: { Location: localeInfo.redirectUrl }
		});
		let match = options && options.__forcedRoute ? {
			route: options.__forcedRoute,
			params: {}
		} : matchRoute(routeUrl, pageRoutes);
		let renderStatusCodeOverride = statusCode;
		let renderAsPath = asPath;
		if (!match) {
			if (isDataReq) return buildNextDataNotFoundResponse();
			if (!renderErrorPageOnMiss) return buildDefaultPagesNotFoundResponse();
			const notFoundRoute = findNotFoundRoute();
			if (notFoundRoute) {
				match = {
					route: notFoundRoute,
					params: {}
				};
				renderStatusCodeOverride = 404;
				renderAsPath = routeUrl;
			} else return buildDefaultPagesNotFoundResponse();
		}
		const { route, params } = match;
		const pageModule = route.module;
		const isStaticPropsRoute = typeof pageModule.getStaticProps === "function";
		const isStaticPropsRender = isStaticPropsRoute && typeof pageModule.getServerSideProps !== "function";
		const renderRouteUrl = isStaticPropsRender ? routeUrl.split("?")[0] : routeUrl;
		const routerAsPathSource = isStaticPropsRender ? renderRouteUrl : renderAsPath ?? renderRouteUrl;
		const routerAsPath = i18nConfig ? extractLocaleFromUrl(routerAsPathSource, i18nConfig, locale).url : routerAsPathSource;
		return runWithRequestContext(createRequestContext({ executionContext: getRequestExecutionContext() }), async () => {
			ensureFetchPatch();
			try {
				const routePattern = patternToNextFormat(route.pattern);
				const renderStatusCode = renderStatusCodeOverride ?? (routePattern === "/404" ? 404 : void 0);
				const query = mergeRouteParamsIntoQuery(parseQueryString(renderRouteUrl), params);
				const isOnDemandRevalidate = isOnDemandRevalidateRequest(request.headers.get(PRERENDER_REVALIDATE_HEADER));
				const preview = isStaticPropsRoute || typeof pageModule.getServerSideProps === "function" ? getPagesPreviewState(request.headers.get("cookie"), { isOnDemandRevalidate }) : {
					data: false,
					shouldClear: false
				};
				const previewData = preview.data;
				const pagesNextData = {
					...buildPagesReadinessNextData({
						pageModule,
						appComponent: AppComponent,
						hasRewrites
					}),
					...previewData === false ? {} : { isPreview: true }
				};
				const navigationIsReady = isStaticPropsRender ? false : typeof getPagesNavigationIsReadyFromSerializedState === "function" ? getPagesNavigationIsReadyFromSerializedState(routePattern, originalRequestUrl.search, pagesNextData) : true;
				function applySSRContext(extra) {
					if (typeof setSSRContext === "function") setSSRContext({
						pathname: routePattern,
						query,
						asPath: routerAsPath,
						navigationIsReady,
						locale,
						locales: i18nConfig ? i18nConfig.locales : void 0,
						defaultLocale: currentDefaultLocale,
						domainLocales,
						...extra
					});
					if (i18nConfig && typeof setI18nContext === "function") setI18nContext({
						locale,
						locales: i18nConfig.locales,
						defaultLocale: currentDefaultLocale,
						domainLocales,
						hostname: new URL(request.url).hostname
					});
				}
				applySSRContext({
					isPreview: previewData !== false,
					nextData: pagesNextData
				});
				const PageComponent = pageModule.default;
				if (!PageComponent) return new Response("Page has no default export", { status: 500 });
				if (!isDataReq && routePattern !== "/_error" && routePattern !== "/404" && routePattern !== "/500" && renderStatusCodeOverride === void 0) {
					const methodResponse = resolvePagesPageMethodResponse({
						hasGetServerSideProps: typeof pageModule.getServerSideProps === "function",
						method: request.method
					});
					if (methodResponse) return methodResponse;
				}
				const pageModuleUrl = resolveClientModuleUrl(manifest, route.filePath, vinextConfig.basePath, vinextConfig.assetPrefix, process.env.__VINEXT_DEPLOYMENT_ID || process.env.NEXT_DEPLOYMENT_ID);
				const appModuleUrl = resolveClientModuleUrl(manifest, appAssetPath, vinextConfig.basePath, vinextConfig.assetPrefix, process.env.__VINEXT_DEPLOYMENT_ID || process.env.NEXT_DEPLOYMENT_ID);
				const serializedPagesNextData = {
					...pagesNextData,
					__vinext: {
						...pagesNextData.__vinext,
						pageModuleUrl,
						appModuleUrl,
						hasMiddleware,
						routeUrl: renderRouteUrl
					}
				};
				const scriptNonce = getScriptNonceFromHeaderSources(request.headers, middlewareHeaders);
				let fontLinkHeader = "";
				let allFontPreloads = [];
				try {
					allFontPreloads = getFontPreloads();
					if (allFontPreloads.length > 0) fontLinkHeader = allFontPreloads.map((p) => "<" + appendAssetDeploymentIdQuery(p.href) + ">; rel=preload; as=font; type=" + p.type + "; crossorigin").join(", ");
				} catch {}
				const pagesResolvedUrl = (new URL(routeUrl, originalRequestUrl).pathname || "/") + originalRequestUrl.search;
				const createPageReqRes = () => {
					const reqRes = createPagesReqRes({
						body: void 0,
						query,
						request,
						url: originalRequestPathAndSearch
					});
					if (typeof renderStatusCode === "number") reqRes.res.statusCode = renderStatusCode;
					return reqRes;
				};
				const pageDataResult = await resolvePagesPageData({
					isDataReq,
					err: err instanceof Error ? err : void 0,
					applyRequestContexts: applySSRContext,
					buildId,
					deploymentId: process.env.__VINEXT_DEPLOYMENT_ID || process.env.NEXT_DEPLOYMENT_ID,
					htmlLimitedBots: vinextConfig.htmlLimitedBots,
					createGsspReqRes: createPageReqRes,
					createAppTree(appTreeProps) {
						const el = createPageElement(PageComponent, AppComponent, appTreeProps);
						return typeof wrapWithRouterContext === "function" ? wrapWithRouterContext(el) : el;
					},
					createPageElement(currentProps) {
						const el = createPageElement(PageComponent, AppComponent, currentProps);
						return typeof wrapWithRouterContext === "function" ? wrapWithRouterContext(el) : el;
					},
					fontLinkHeader,
					i18n: buildI18nRenderContext(i18nConfig, locale, currentDefaultLocale, domainLocales),
					isrCacheKey: pageIsrCacheKey,
					isrGet,
					isrSet,
					expireSeconds: vinextConfig.expireTime,
					isBuildTimePrerendering: typeof process !== "undefined" && process.env && process.env.VINEXT_PRERENDER === "1",
					validatePropsSerialization: process.env.NODE_ENV !== "production" || process.env.VINEXT_PRERENDER === "1",
					isOnDemandRevalidate,
					previewData,
					pageModule,
					AppComponent,
					router,
					params,
					query,
					asPath: routerAsPath,
					resolvedUrl: pagesResolvedUrl,
					renderIsrPassToStringAsync,
					route: { isDynamic: route.isDynamic },
					routePattern,
					routeUrl: renderRouteUrl,
					runInFreshUnifiedContext(callback) {
						return runWithRequestContext(createRequestContext({ executionContext: null }), async () => {
							ensureFetchPatch();
							return callback();
						});
					},
					safeJsonStringify,
					sanitizeDestination,
					scriptNonce,
					statusCode: renderStatusCode,
					triggerBackgroundRegeneration,
					vinext: serializedPagesNextData.__vinext,
					nextData: serializedPagesNextData,
					userAgent: request.headers.get("user-agent") ?? void 0,
					ifNoneMatch: request.headers.get("if-none-match") ?? void 0,
					requestCacheControl: request.headers.get("cache-control") ?? void 0
				});
				if (pageDataResult.kind === "notFound") {
					const notFoundRoute = findNotFoundRoute();
					if (notFoundRoute && routePattern !== "/404" && routePattern !== "/_error") return finalizePagesPreviewResponse(await renderPage(request, url, manifest, middlewareHeaders, {
						statusCode: 404,
						asPath: routerAsPath,
						renderErrorPageOnMiss: false,
						__forcedRoute: notFoundRoute
					}), preview);
					return finalizePagesPreviewResponse(buildDefaultPagesNotFoundResponse(), preview);
				}
				if (pageDataResult.kind === "response") return finalizePagesPreviewResponse(pageDataResult.response, preview);
				let pageProps = pageDataResult.pageProps;
				let renderProps = pageDataResult.props;
				if (previewData !== false) renderProps = {
					...renderProps,
					__N_PREVIEW: true
				};
				if (routePattern === "/_error" && typeof renderStatusCode === "number" && renderProps.pageProps !== void 0) {
					pageProps = {
						...pageProps,
						statusCode: renderStatusCode
					};
					renderProps = {
						...renderProps,
						pageProps
					};
				}
				const gsspRes = pageDataResult.gsspRes;
				const documentReqRes = serializedPagesNextData.autoExport === true ? null : pageDataResult.documentReqRes ?? createPageReqRes();
				const isrRevalidateSeconds = pageDataResult.isrRevalidateSeconds;
				const isFallbackRender = pageDataResult.isFallback === true;
				if (isFallbackRender) applySSRContext({
					query: {},
					asPath: routePattern,
					navigationIsReady: false,
					isFallback: true
				});
				if (isDataReq) {
					const init = { headers: {} };
					if (gsspRes && typeof gsspRes.getHeaders === "function") {
						const gsspHeaders = gsspRes.getHeaders();
						for (const k of Object.keys(gsspHeaders)) {
							const v = gsspHeaders[k];
							if (v === void 0 || v === null) continue;
							init.headers[k] = Array.isArray(v) ? v.join(", ") : String(v);
						}
					}
					if (gsspRes) {
						let hasUserCacheControl = false;
						for (const headerKey of Object.keys(init.headers)) if (headerKey.toLowerCase() === "cache-control") {
							hasUserCacheControl = true;
							break;
						}
						if (!hasUserCacheControl) init.headers["Cache-Control"] = NEVER_CACHE_CONTROL;
					} else if (isStaticPropsRoute) {
						if (isrRevalidateSeconds) {
							const headers = new Headers(init.headers);
							applyCdnResponseHeaders(headers, { cacheControl: buildMissIsrCacheControl(isrRevalidateSeconds, vinextConfig.expireTime) });
							for (const [key, value] of headers) init.headers[key] = value;
						} else if (shouldUseNextDeployCacheControl()) init.headers["Cache-Control"] = BROWSER_REVALIDATE_CACHE_CONTROL;
					}
					if (routePattern !== "/_error" && routePattern !== "/500") {
						const deploymentId = process.env.__VINEXT_DEPLOYMENT_ID || process.env.NEXT_DEPLOYMENT_ID;
						if (deploymentId) init.headers[NEXTJS_DEPLOYMENT_ID_HEADER] = deploymentId;
					}
					return finalizePagesPreviewResponse(buildNextDataPropsJsonResponse(renderProps, safeJsonStringify, init), preview);
				}
				const pageModuleIds = [];
				if (appAssetPath) pageModuleIds.push(appAssetPath);
				if (route.filePath) pageModuleIds.push(route.filePath);
				return finalizePagesPreviewResponse(await renderPagesPageResponse({
					assetTags: collectAssetTags({
						manifest,
						moduleIds: pageModuleIds,
						scriptNonce,
						disableOptimizedLoading: vinextConfig.disableOptimizedLoading,
						basePath: vinextConfig.basePath,
						assetPrefix: vinextConfig.assetPrefix,
						deploymentId: process.env.__VINEXT_DEPLOYMENT_ID || process.env.NEXT_DEPLOYMENT_ID
					}),
					buildId,
					clearSsrContext() {
						if (typeof setSSRContext === "function") setSSRContext(null);
					},
					createPageElement(currentProps) {
						const el = createPageElement(PageComponent, AppComponent, currentProps);
						return typeof wrapWithRouterContext === "function" ? wrapWithRouterContext(el) : el;
					},
					enhancePageElement(renderPageOpts) {
						const el = enhancePageElement(PageComponent, AppComponent, renderProps, renderPageOpts);
						return typeof wrapWithRouterContext === "function" ? wrapWithRouterContext(el) : el;
					},
					DocumentComponent,
					err: err instanceof Error ? err : void 0,
					flushPreloads: typeof flushPreloads === "function" ? flushPreloads : void 0,
					fontLinkHeader,
					fontPreloads: allFontPreloads,
					getFontLinks,
					getFontStyles,
					getSSRHeadHTML: typeof getSSRHeadHTML === "function" ? getSSRHeadHTML : void 0,
					clientTraceMetadata: shouldEmitPagesClientTraceMetadata(pageModule, AppComponent) ? vinextConfig.clientTraceMetadata : void 0,
					documentReqRes,
					gsspRes,
					isrCacheKey: pageIsrCacheKey,
					expireSeconds: vinextConfig.expireTime,
					isrRevalidateSeconds,
					isStaticPropsRoute,
					isrSet,
					i18n: buildI18nRenderContext(i18nConfig, locale, currentDefaultLocale, domainLocales),
					isFallback: isFallbackRender,
					pageProps,
					props: renderProps,
					params,
					query,
					renderDocumentToString(element) {
						return renderToStringAsync(element);
					},
					renderToReadableStream,
					resetSSRHead: typeof resetSSRHead === "function" ? resetSSRHead : void 0,
					setDocumentInitialHead: typeof setDocumentInitialHead === "function" ? setDocumentInitialHead : void 0,
					routePattern,
					routeUrl: renderRouteUrl,
					safeJsonStringify,
					scriptNonce,
					statusCode: renderStatusCode,
					nextData: serializedPagesNextData,
					userAgent: request.headers.get("user-agent") ?? void 0,
					ifNoneMatch: request.headers.get("if-none-match") ?? void 0,
					requestCacheControl: request.headers.get("cache-control") ?? void 0
				}), preview);
			} catch (e) {
				console.error("[vinext] SSR error:", e);
				reportRequestError(e instanceof Error ? e : new Error(String(e)), {
					path: url,
					method: request.method,
					headers: Object.fromEntries(request.headers.entries())
				}, {
					routerKind: "Pages Router",
					routePath: route.pattern,
					routeType: "render"
				}).catch(() => {});
				if (!isInternalErrorRender && !isDataReq) {
					let errorRoute = null;
					for (let i = 0; i < pageRoutes.length; i++) if (pageRoutes[i].pattern === "/500") {
						errorRoute = pageRoutes[i];
						break;
					}
					if (!errorRoute && errorPageRoute) errorRoute = errorPageRoute;
					if (errorRoute) try {
						return await renderPage(request, url, manifest, middlewareHeaders, {
							statusCode: 500,
							asPath: url,
							renderErrorPageOnMiss: false,
							__isInternalErrorRender: true,
							__forcedRoute: errorRoute,
							err: e instanceof Error ? e : new Error(String(e))
						});
					} catch (errorPageErr) {
						console.error("[vinext] Error page render failed:", errorPageErr);
					}
				}
				return new Response("Internal Server Error", { status: 500 });
			}
		});
	}
	return renderPage;
}
//#endregion
export { createPagesPageHandler, shouldEmitPagesClientTraceMetadata };
