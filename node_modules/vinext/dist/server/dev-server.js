import { createRequestContext, runWithRequestContext } from "../shims/unified-request-context.js";
import path from "../deps/.pnpm/pathslash@0.1.0/deps/pathslash/dist/index.js";
import { createValidFileMatcher, findFileWithExtensions, findFileWithExts } from "../routing/file-matcher.js";
import { patternToNextFormat } from "../routing/route-validation.js";
import { matchRoute } from "../routing/pages-router.js";
import { NEXTJS_DEPLOYMENT_ID_HEADER } from "./headers.js";
import { isDangerousScheme } from "../shims/url-safety.js";
import { importModule, reportRequestError } from "./instrumentation.js";
import { buildCacheStateHeaders } from "./cache-headers.js";
import { isUnknownRecord } from "../utils/record.js";
import { NEVER_CACHE_CONTROL, NO_STORE_CACHE_CONTROL } from "./cache-control.js";
import { buildMissIsrCacheControl, decideIsr } from "./isr-decision.js";
import { PRERENDER_REVALIDATE_HEADER, buildPagesCacheValue, getRevalidateDuration, isOnDemandRevalidateRequest, isrCacheKey, isrGet, isrSet, setRevalidateDuration, triggerBackgroundRegeneration } from "./isr-cache.js";
import { _runWithCacheState } from "../shims/cache-request-state.js";
import { ensureFetchPatch, runWithFetchCache } from "../shims/fetch-cache.js";
import { runWithPrivateCache } from "../shims/cache-runtime.js";
import { mergeRouteParamsIntoQuery, parseQueryString } from "../utils/query.js";
import "../shims/router-state.js";
import { runWithHeadState } from "../shims/head-state.js";
import { runWithServerInsertedHTMLState } from "../shims/navigation-state.js";
import { withScriptNonce } from "../shims/script-nonce-context.js";
import { createInlineScriptTag, createNonceAttribute, escapeHtmlAttr, safeJsonStringify } from "./html.js";
import { getClientTraceMetadataHTML } from "./client-trace-metadata.js";
import { getScriptNonceFromNodeHeaderSources } from "./csp.js";
import { logRequest, now } from "./request-log.js";
import { detectLocaleFromAcceptLanguage, extractLocaleFromUrl as extractLocaleFromUrl$1, parseCookieLocaleFromHeader, resolvePagesI18nRequest } from "./pages-i18n.js";
import { buildDefaultPagesNotFoundResponse } from "./pages-default-404.js";
import { buildPagesReadinessNextData } from "./pages-readiness.js";
import { resolvePagesPageMethodResponse } from "./pages-page-method.js";
import { loadUserDocumentInitialProps, runDocumentRenderPage } from "./pages-document-initial-props.js";
import { callDocumentGetInitialProps } from "./document-initial-head.js";
import { hasPagesGetInitialProps, loadDevAppInitialProps, loadPagesGetInitialProps } from "./pages-get-initial-props.js";
import { isSerializableProps } from "./pages-serializable-props.js";
import { isBotUserAgent } from "../utils/html-limited-bots.js";
import { getPagesRouteParams, matchesPagesStaticPath } from "./pages-page-data.js";
import { createPagesDevAssetUrl, createPagesDevModuleUrl } from "./pages-dev-module-url.js";
import { createPagesDevHydrationScript } from "./pages-dev-hydration.js";
import { getManifestFilesForModule } from "./pages-asset-tags.js";
import { PAGES_PREVIEW_CACHE_CONTROL, appendPagesPreviewClearCookies, getPagesPreviewState } from "./pages-preview.js";
import { attachPagesRequestCookies } from "./pages-node-compat.js";
import React from "react";
import { renderToReadableStream } from "react-dom/server.edge";
//#region src/server/dev-server.ts
/**
* Render a React element to a string using renderToReadableStream.
*
* Uses the edge-compatible Web Streams API. Waits for all Suspense
* boundaries to resolve via stream.allReady before collecting output.
* Used for _document rendering and error pages (small, non-streaming).
*/
async function renderToStringAsync(element) {
	const stream = await renderToReadableStream(element);
	await stream.allReady;
	return new Response(stream).text();
}
function applyDevPagesPreviewHeaders(headers, preview) {
	const removeHeader = (name) => {
		for (const key of Object.keys(headers)) if (key.toLowerCase() === name) delete headers[key];
	};
	if (preview.data !== false) {
		removeHeader("cache-control");
		headers["Cache-Control"] = PAGES_PREVIEW_CACHE_CONTROL;
	}
	if (preview.shouldClear) {
		const clearHeaders = new Headers();
		for (const [key, value] of Object.entries(headers)) {
			if (key.toLowerCase() !== "set-cookie") continue;
			if (Array.isArray(value)) for (const cookie of value) clearHeaders.append("Set-Cookie", String(cookie));
			else clearHeaders.append("Set-Cookie", String(value));
			delete headers[key];
		}
		appendPagesPreviewClearCookies(clearHeaders);
		headers["Set-Cookie"] = clearHeaders.getSetCookie();
	}
}
function applyDevPagesPreviewResponse(res, preview) {
	const headers = res.getHeaders();
	applyDevPagesPreviewHeaders(headers, preview);
	for (const [name, value] of Object.entries(headers)) res.setHeader(name, value);
}
async function renderIsrPassToStringAsync(element) {
	return await runWithServerInsertedHTMLState(() => runWithHeadState(() => _runWithCacheState(() => runWithPrivateCache(() => runWithFetchCache(async () => renderToStringAsync(element))))));
}
const DEV_STYLESHEET_ASSET_RE = /\.(?:css|scss|sass)$/i;
const transformedStylesheetAssetsCache = /* @__PURE__ */ new WeakMap();
const transformedStylesheetAssetsWatchers = /* @__PURE__ */ new WeakSet();
function createDevInitialStylesheetHeadHTML(options) {
	const { ssrManifest, moduleIds, nonceAttr } = options;
	if (!ssrManifest || moduleIds.length === 0) return "";
	const seen = /* @__PURE__ */ new Set();
	let html = "";
	for (const moduleId of moduleIds) {
		const files = getManifestFilesForModule(ssrManifest, moduleId);
		if (!files) continue;
		for (const file of files) {
			if (!DEV_STYLESHEET_ASSET_RE.test(file) || seen.has(file)) continue;
			seen.add(file);
			const href = createPagesDevAssetUrl(file);
			html += `<link rel="stylesheet"${nonceAttr} href="${escapeHtmlAttr(href)}" />\n  `;
		}
	}
	return html;
}
async function collectTransformedStylesheetAssets(server, moduleIds) {
	const clientEnvironment = server.environments.client;
	if (!clientEnvironment) return [];
	const cachedServerAssets = transformedStylesheetAssetsCache.get(server);
	const cache = cachedServerAssets ?? /* @__PURE__ */ new Map();
	if (!cachedServerAssets) transformedStylesheetAssetsCache.set(server, cache);
	if (!transformedStylesheetAssetsWatchers.has(server)) {
		transformedStylesheetAssetsWatchers.add(server);
		const clearCache = () => cache.clear();
		server.watcher.on("add", clearCache);
		server.watcher.on("change", clearCache);
		server.watcher.on("unlink", clearCache);
	}
	const cacheKey = moduleIds.filter((moduleId) => Boolean(moduleId)).join("\0");
	const cachedAssets = cache.get(cacheKey);
	if (cachedAssets) return cachedAssets;
	const assets = /* @__PURE__ */ new Set();
	const seenModules = /* @__PURE__ */ new Set();
	async function visitModule(moduleUrl) {
		if (seenModules.has(moduleUrl)) return;
		seenModules.add(moduleUrl);
		try {
			await clientEnvironment.transformRequest(moduleUrl);
			const moduleNode = await clientEnvironment.moduleGraph.getModuleByUrl(moduleUrl);
			if (!moduleNode) return;
			for (const importedModule of moduleNode.importedModules) if (importedModule.type === "css" || /\.(?:css|scss|sass)(?:$|[?#])/i.test(importedModule.url)) {
				if (importedModule.url.startsWith("//")) continue;
				const assetUrl = importedModule.url.startsWith("\0") ? `/@id/__x00__${importedModule.url.slice(1)}${importedModule.url.includes("?") ? "&" : "?"}direct` : importedModule.url;
				assets.add(assetUrl);
			} else if (importedModule.type === "js") await visitModule(importedModule.url);
		} catch {}
	}
	for (const moduleId of moduleIds) {
		if (!moduleId) continue;
		await visitModule(createPagesDevModuleUrl(server.config.root, moduleId, "/"));
	}
	const result = [...assets];
	cache.set(cacheKey, result);
	return result;
}
async function collectDevInitialStylesheetHeadHTML(server, runner, moduleIds, nonceAttr) {
	let manifestHTML = "";
	try {
		manifestHTML = createDevInitialStylesheetHeadHTML({
			ssrManifest: (await runner.import("virtual:vinext-pages-client-assets")).default?.ssrManifest,
			moduleIds,
			nonceAttr
		});
	} catch {}
	const transformedAssets = await collectTransformedStylesheetAssets(server, moduleIds);
	if (transformedAssets.length === 0) return manifestHTML;
	let html = manifestHTML;
	for (const asset of transformedAssets) {
		const href = asset.startsWith("/") ? asset : createPagesDevAssetUrl(asset);
		if (html.includes(`href="${escapeHtmlAttr(href)}"`)) continue;
		html += `<link rel="stylesheet"${nonceAttr} href="${escapeHtmlAttr(href)}" />\n  `;
	}
	return html;
}
/**
* Emit a `getServerSideProps` / `getStaticProps` `{ redirect }` result.
*
* For an HTML request we write a real HTTP redirect (`Location`). For a
* `_next/data` request we instead reply 200 with `__N_REDIRECT` /
* `__N_REDIRECT_STATUS` in pageProps so the client router re-dispatches a
* fresh client navigation (which supersedes the in-flight one) rather than
* the fetch transparently following an HTTP redirect to non-JSON HTML. This
* mirrors the production path in `pages-page-data.ts`
* (`buildPagesRedirectResponse`) and Next.js's `render.tsx` `__N_REDIRECT`
* handling. See AGENTS.md "dev and prod server parity".
*/
function writeGsspRedirect(res, redirect, isDataReq, props) {
	const status = redirect.statusCode ?? (redirect.permanent ? 308 : 307);
	let dest = redirect.destination;
	if (!dest.startsWith("http://") && !dest.startsWith("https://")) dest = dest.replace(/^[\\/]+/, "/");
	if (isDangerousScheme(dest)) {
		const deploymentId = process.env.__VINEXT_DEPLOYMENT_ID || process.env.NEXT_DEPLOYMENT_ID;
		const headers = {
			"Cache-Control": "private, no-cache, no-store, max-age=0, must-revalidate",
			"Content-Type": "text/plain; charset=utf-8"
		};
		if (deploymentId) headers[NEXTJS_DEPLOYMENT_ID_HEADER] = deploymentId;
		res.writeHead(500, headers);
		res.end("Invalid redirect destination");
		return;
	}
	if (isDataReq) {
		const deploymentId = process.env.__VINEXT_DEPLOYMENT_ID || process.env.NEXT_DEPLOYMENT_ID;
		const dataHeaders = { "Content-Type": "application/json" };
		if (deploymentId) dataHeaders[NEXTJS_DEPLOYMENT_ID_HEADER] = deploymentId;
		res.writeHead(200, dataHeaders);
		res.end(JSON.stringify({
			...props,
			pageProps: {
				...isUnknownRecord(props.pageProps) ? props.pageProps : {},
				__N_REDIRECT: dest,
				__N_REDIRECT_STATUS: status
			}
		}));
		return;
	}
	res.writeHead(status, { Location: dest });
	res.end();
}
/** Body placeholder used to split the document shell for streaming. */
const STREAM_BODY_MARKER = "<!--VINEXT_STREAM_BODY-->";
/**
* Stream a Pages Router page response using progressive SSR.
*
* Sends the HTML shell (head, layout, Suspense fallbacks) immediately
* when the React shell is ready, then streams Suspense content as it
* resolves. This gives the browser content to render while slow data
* loads are still in flight.
*
* `__NEXT_DATA__` and the hydration script are appended after the body
* stream completes (the data is known before rendering starts, but
* deferring them reduces TTFB and lets the browser start parsing the
* shell sooner).
*/
async function streamPageToResponse(res, element, options) {
	const { url, server, fontHeadHTML, assetHeadHTML = "", scripts, DocumentComponent, statusCode, extraHeaders, getHeadHTML, enhancePageElement, scriptNonce, documentContext, setDocumentInitialHead, bufferBodyBeforeHeaders = false } = options;
	const documentRenderPage = await runDocumentRenderPage({
		DocumentComponent,
		enhancePageElement,
		renderToReadableStream,
		renderStylesToString: renderToStringAsync,
		scriptNonce,
		context: documentContext
	});
	if (res.headersSent || res.writableEnded) return;
	let bodyStream;
	if (documentRenderPage.status === "rendered") {
		const synthesised = documentRenderPage.bodyHtml;
		bodyStream = new ReadableStream({ start(controller) {
			controller.enqueue(new TextEncoder().encode(synthesised));
			controller.close();
		} });
	} else bodyStream = await renderToReadableStream(element);
	if (documentRenderPage.status === "skipped") await callDocumentGetInitialProps(DocumentComponent, setDocumentInitialHead);
	else setDocumentInitialHead?.(documentRenderPage.head);
	let headHTML = getHeadHTML();
	if (documentRenderPage.status === "rendered" && documentRenderPage.stylesHTML) headHTML += `\n  ${documentRenderPage.stylesHTML}`;
	let shellTemplate;
	if (DocumentComponent) {
		const docProps = documentRenderPage.status === "skipped" ? await loadUserDocumentInitialProps(DocumentComponent) : documentRenderPage.docProps;
		let docHtml = await renderToStringAsync(docProps ? React.createElement(DocumentComponent, docProps) : React.createElement(DocumentComponent));
		docHtml = docHtml.replace("__NEXT_MAIN__", STREAM_BODY_MARKER);
		if (headHTML || fontHeadHTML || assetHeadHTML) docHtml = docHtml.replace("</head>", `  ${fontHeadHTML}${headHTML}\n  ${assetHeadHTML}\n</head>`);
		docHtml = docHtml.replace("<!-- __NEXT_SCRIPTS__ -->", scripts);
		if (!docHtml.includes("__NEXT_DATA__")) docHtml = docHtml.replace("</body>", `  ${scripts}\n</body>`);
		shellTemplate = docHtml;
	} else shellTemplate = `<!DOCTYPE html>
<html>
<head>
  ${fontHeadHTML}${headHTML}
  ${assetHeadHTML}
</head>
<body>
  <div id="__next">${STREAM_BODY_MARKER}</div>
  ${scripts}
</body>
</html>`;
	const transformedShell = await server.transformIndexHtml(url, shellTemplate);
	const markerIdx = transformedShell.indexOf(STREAM_BODY_MARKER);
	const prefix = transformedShell.slice(0, markerIdx);
	const suffix = transformedShell.slice(markerIdx + 25);
	const bufferedBody = bufferBodyBeforeHeaders ? await new Response(bodyStream).text() : null;
	const headers = {
		"Content-Type": "text/html; charset=utf-8",
		"Transfer-Encoding": "chunked"
	};
	if (extraHeaders) for (const [key, val] of Object.entries(extraHeaders)) if (Array.isArray(val)) res.setHeader(key, val);
	else headers[key] = val;
	res.writeHead(statusCode ?? res.statusCode, headers);
	res.write(prefix);
	if (bufferedBody !== null) {
		res.end(bufferedBody + suffix);
		return;
	}
	const reader = bodyStream.getReader();
	try {
		for (;;) {
			const { done, value } = await reader.read();
			if (done) break;
			res.write(value);
		}
	} finally {
		reader.releaseLock();
	}
	res.end(suffix);
}
/**
* Extract locale prefix from a URL path.
* e.g. /fr/about -> { locale: "fr", url: "/about", hadPrefix: true }
*      /about    -> { locale: "en", url: "/about", hadPrefix: false } (defaultLocale)
*/
function extractLocaleFromUrl(url, i18nConfig) {
	return extractLocaleFromUrl$1(url, i18nConfig);
}
/**
* Detect the preferred locale from the Accept-Language header.
* Returns the best matching locale or null.
*/
function detectLocaleFromHeaders(req, i18nConfig) {
	return detectLocaleFromAcceptLanguage(req.headers["accept-language"], i18nConfig);
}
/**
* Parse the NEXT_LOCALE cookie from a request.
* Returns the cookie value if it matches a configured locale, otherwise null.
*/
function parseCookieLocale(req, i18nConfig) {
	return parseCookieLocaleFromHeader(req.headers.cookie, i18nConfig);
}
/**
* Create an SSR request handler for the Pages Router.
*
* For each request:
* 1. Match the URL against discovered routes
* 2. Load the page module via the ModuleRunner
* 3. Call getServerSideProps/getStaticProps if present
* 4. Render the component to HTML
* 5. Wrap in _document shell and send response
*/
function createSSRHandler(server, runner, routes, pagesDir, i18nConfig, fileMatcher, basePath = "", trailingSlash = false, hasMiddleware = false, hasRewrites = false, clientTraceMetadata, htmlLimitedBots, reactStrictMode = false) {
	const matcher = fileMatcher ?? createValidFileMatcher();
	const pagePatterns = routes.map((r) => patternToNextFormat(r.pattern));
	const _alsRegistration = Promise.all([runner.import("vinext/head-state"), runner.import("vinext/router-state")]);
	_alsRegistration.catch(() => {});
	return async (req, res, url, statusCode, isDataReq = false, originalUrl = url) => {
		const _reqStart = now();
		let _compileEnd;
		let _renderEnd;
		attachPagesRequestCookies(req);
		res.on("finish", () => {
			const totalMs = now() - _reqStart;
			const compileMs = _compileEnd !== void 0 ? Math.round(_compileEnd - _reqStart) : void 0;
			const renderMs = _renderEnd !== void 0 && _compileEnd !== void 0 ? Math.round(_renderEnd - _compileEnd) : void 0;
			logRequest({
				method: req.method ?? "GET",
				url,
				status: res.statusCode,
				totalMs,
				compileMs,
				renderMs
			});
		});
		let locale;
		let localeStrippedUrl = url;
		let currentDefaultLocale;
		let currentDomainLocaleDomain;
		const domainLocales = i18nConfig?.domains;
		if (i18nConfig) {
			const resolved = resolvePagesI18nRequest(url, i18nConfig, req.headers, req.headers.host, basePath, trailingSlash);
			locale = resolved.locale;
			localeStrippedUrl = resolved.url;
			currentDefaultLocale = resolved.domainLocale?.defaultLocale ?? i18nConfig.defaultLocale;
			currentDomainLocaleDomain = resolved.domainLocale?.domain;
			if (resolved.redirectUrl) {
				res.writeHead(307, { Location: resolved.redirectUrl });
				res.end();
				return;
			}
		}
		const i18nCacheVariant = i18nConfig ? currentDomainLocaleDomain ? "domain:" + currentDomainLocaleDomain.toLowerCase() : "locale:" + String(locale) : null;
		const pagesIsrCacheKey = i18nCacheVariant ? (pathname) => isrCacheKey("pages", pathname + "::i18n=" + encodeURIComponent(i18nCacheVariant), process.env.__VINEXT_BUILD_ID) : (pathname) => isrCacheKey("pages", pathname, process.env.__VINEXT_BUILD_ID);
		const match = matchRoute(localeStrippedUrl, routes);
		if (!match) {
			if (isDataReq) {
				const deploymentId = process.env.__VINEXT_DEPLOYMENT_ID || process.env.NEXT_DEPLOYMENT_ID;
				const notFoundHeaders = { "Content-Type": "application/json" };
				if (hasMiddleware) notFoundHeaders["x-nextjs-matched-path"] = `${locale ? `/${locale}` : ""}${localeStrippedUrl}`;
				if (deploymentId) notFoundHeaders[NEXTJS_DEPLOYMENT_ID_HEADER] = deploymentId;
				res.writeHead(hasMiddleware ? 200 : 404, notFoundHeaders);
				res.end("{}");
				return;
			}
			await runWithRequestContext(createRequestContext(), async () => {
				await _alsRegistration;
				await renderErrorPage(server, runner, req, res, url, pagesDir, 404, void 0, matcher, void 0, reactStrictMode);
			});
			return;
		}
		const { route, params } = match;
		req.url = originalUrl;
		const parsedResolvedUrl = new URL(localeStrippedUrl, "http://vinext.local");
		const originalRequestSearch = new URL(originalUrl, "http://vinext.local").search;
		const gsspResolvedUrl = parsedResolvedUrl.pathname + originalRequestSearch;
		let requestAsPath = isDataReq ? gsspResolvedUrl : i18nConfig ? extractLocaleFromUrl$1(originalUrl, i18nConfig, locale).url : originalUrl;
		const userFacingParams = route.isDynamic ? params : null;
		let query = mergeRouteParamsIntoQuery(parseQueryString(url), params);
		return runWithRequestContext(createRequestContext(), async () => {
			ensureFetchPatch();
			try {
				await _alsRegistration;
				const routerShim = await importModule(runner, "next/router");
				if (i18nConfig) {
					await runner.import("vinext/i18n-state");
					const i18nCtx = await importModule(runner, "vinext/i18n-context");
					if (typeof i18nCtx.setI18nContext === "function") i18nCtx.setI18nContext({
						locale: locale ?? currentDefaultLocale,
						locales: i18nConfig.locales,
						defaultLocale: currentDefaultLocale,
						domainLocales,
						hostname: req.headers.host?.split(":", 1)[0]
					});
				}
				const pageModule = await importModule(runner, route.filePath);
				const isStaticPropsRender = typeof pageModule.getStaticProps === "function" && typeof pageModule.getServerSideProps !== "function";
				if (isStaticPropsRender) {
					query = mergeRouteParamsIntoQuery({}, params);
					requestAsPath = localeStrippedUrl.split("?")[0];
				}
				const requestPreview = typeof pageModule.getStaticProps === "function" || typeof pageModule.getServerSideProps === "function" ? getPagesPreviewState(req.headers.cookie, { isOnDemandRevalidate: isOnDemandRevalidateRequest(req.headers[PRERENDER_REVALIDATE_HEADER]) }) : {
					data: false,
					shouldClear: false
				};
				const requestPreviewData = requestPreview.data;
				let AppComponent = null;
				const appPath = path.join(pagesDir, "_app");
				if (findFileWithExtensions(appPath, matcher)) try {
					AppComponent = (await importModule(runner, appPath)).default ?? null;
				} catch {}
				const pagesNextData = {
					...buildPagesReadinessNextData({
						pageModule,
						appComponent: AppComponent,
						hasRewrites
					}),
					...requestPreviewData === false ? {} : { isPreview: true }
				};
				const navigationIsReady = isStaticPropsRender ? false : typeof routerShim.getPagesNavigationIsReadyFromSerializedState === "function" ? routerShim.getPagesNavigationIsReadyFromSerializedState(patternToNextFormat(route.pattern), new URL(url, "http://_").search, pagesNextData) : true;
				if (typeof routerShim.setSSRContext === "function") routerShim.setSSRContext({
					pathname: patternToNextFormat(route.pattern),
					query,
					asPath: requestAsPath,
					navigationIsReady,
					nextData: pagesNextData,
					locale: locale ?? currentDefaultLocale,
					locales: i18nConfig?.locales,
					defaultLocale: currentDefaultLocale,
					domainLocales,
					isPreview: requestPreviewData !== false
				});
				_compileEnd = now();
				const PageComponent = pageModule.default;
				if (!PageComponent) {
					console.error(`[vinext] Page ${route.filePath} has no default export`);
					res.statusCode = 500;
					res.end("Page has no default export");
					return;
				}
				{
					const routePattern = patternToNextFormat(route.pattern);
					if (!isDataReq && routePattern !== "/_error" && routePattern !== "/404" && routePattern !== "/500" && statusCode === void 0) {
						const methodResponse = resolvePagesPageMethodResponse({
							hasGetServerSideProps: typeof pageModule.getServerSideProps === "function",
							method: req.method ?? "GET"
						});
						if (methodResponse) {
							res.statusCode = methodResponse.status;
							const allow = methodResponse.headers.get("allow");
							if (allow) res.setHeader("Allow", allow);
							res.setHeader("Content-Type", "text/plain;charset=UTF-8");
							res.end(await methodResponse.text());
							return;
						}
					}
				}
				let pageProps = {};
				let renderProps = { pageProps };
				if (requestPreviewData !== false) renderProps.__N_PREVIEW = true;
				let isrRevalidateSeconds = null;
				let isFallbackRender = false;
				let shouldPersistFallbackData = false;
				let staticPropsPreviewData = requestPreviewData;
				if (typeof pageModule.getStaticPaths === "function" && route.isDynamic) {
					const pathsResult = await pageModule.getStaticPaths({
						locales: i18nConfig?.locales ?? [],
						defaultLocale: currentDefaultLocale ?? ""
					});
					const fallback = pathsResult?.fallback ?? false;
					const paths = pathsResult?.paths ?? [];
					const routeParams = getPagesRouteParams(patternToNextFormat(route.pattern));
					const isValidPath = paths.some((pathEntry) => matchesPagesStaticPath(pathEntry, params, routeParams, url));
					if (fallback === false && !isValidPath && requestPreviewData === false) {
						if (isDataReq) {
							const deploymentId = process.env.__VINEXT_DEPLOYMENT_ID || process.env.NEXT_DEPLOYMENT_ID;
							const notFoundHeaders = { "Content-Type": "application/json" };
							if (deploymentId) notFoundHeaders[NEXTJS_DEPLOYMENT_ID_HEADER] = deploymentId;
							res.writeHead(404, notFoundHeaders);
							res.end("{}");
							return;
						}
						await renderErrorPage(server, runner, req, res, url, pagesDir, 404, routerShim.wrapWithRouterContext, matcher, void 0, reactStrictMode);
						return;
					}
					const userAgentHeader = req.headers["user-agent"];
					const userAgent = Array.isArray(userAgentHeader) ? userAgentHeader[0] : userAgentHeader;
					const isBotRequest = !!userAgent && isBotUserAgent(userAgent, htmlLimitedBots);
					if (fallback === true && !isValidPath && !isDataReq && !isBotRequest && requestPreviewData === false) {
						isFallbackRender = (await isrGet(pagesIsrCacheKey(url.split("?")[0])))?.value.value?.kind !== "PAGES";
						if (isFallbackRender && typeof routerShim.setSSRContext === "function") routerShim.setSSRContext({
							pathname: patternToNextFormat(route.pattern),
							query: {},
							asPath: patternToNextFormat(route.pattern),
							navigationIsReady: false,
							locale: locale ?? currentDefaultLocale,
							locales: i18nConfig?.locales,
							defaultLocale: currentDefaultLocale,
							domainLocales,
							isFallback: true
						});
					}
					shouldPersistFallbackData = fallback === true && !isValidPath && isDataReq;
				}
				const gsspExtraHeaders = {};
				const hasAppGetInitialProps = hasPagesGetInitialProps(AppComponent);
				async function loadAppInitialProps() {
					if (!hasAppGetInitialProps) return false;
					const appResult = await loadDevAppInitialProps({
						appComponent: AppComponent,
						appTree: (appTreeProps) => {
							const appTree = React.createElement(AppComponent, {
								...appTreeProps,
								Component: PageComponent,
								pageProps: appTreeProps.pageProps,
								router: routerShim.default
							});
							return typeof routerShim.wrapWithRouterContext === "function" ? routerShim.wrapWithRouterContext(appTree) : appTree;
						},
						component: PageComponent,
						req,
						res,
						pathname: patternToNextFormat(route.pattern),
						query,
						asPath: requestAsPath,
						router: routerShim.default,
						locale: locale ?? currentDefaultLocale,
						locales: i18nConfig?.locales,
						defaultLocale: currentDefaultLocale
					});
					if (appResult.kind === "response-sent") return true;
					if (appResult.kind === "render") {
						pageProps = appResult.pageProps;
						renderProps = appResult.renderProps;
						if (requestPreviewData !== false) renderProps.__N_PREVIEW = true;
					}
					return false;
				}
				if (typeof pageModule.getServerSideProps === "function" && !isFallbackRender) {
					if (await loadAppInitialProps()) return;
					renderProps = {
						...renderProps,
						__N_SSP: true
					};
					const headersBeforeGSSP = new Set(Object.keys(res.getHeaders()));
					const previewData = requestPreviewData;
					const previewContext = previewData === false ? {} : {
						draftMode: true,
						preview: true,
						previewData
					};
					const context = {
						params: userFacingParams,
						req,
						res,
						query,
						resolvedUrl: gsspResolvedUrl,
						locale: locale ?? currentDefaultLocale,
						locales: i18nConfig?.locales,
						defaultLocale: currentDefaultLocale,
						...previewContext
					};
					const result = await pageModule.getServerSideProps(context);
					if (res.writableEnded) return;
					if (result && "props" in result) {
						pageProps = {
							...pageProps,
							...await Promise.resolve(result.props)
						};
						renderProps = {
							...renderProps,
							pageProps
						};
					}
					if (result && "redirect" in result) {
						writeGsspRedirect(res, result.redirect, isDataReq, renderProps);
						return;
					}
					if (result && "notFound" in result && result.notFound) {
						applyDevPagesPreviewResponse(res, requestPreview);
						if (isDataReq) {
							const deploymentId = process.env.__VINEXT_DEPLOYMENT_ID || process.env.NEXT_DEPLOYMENT_ID;
							const notFoundHeaders = { "Content-Type": "application/json" };
							if (deploymentId) notFoundHeaders[NEXTJS_DEPLOYMENT_ID_HEADER] = deploymentId;
							res.writeHead(404, notFoundHeaders);
							res.end("{}");
							return;
						}
						await renderErrorPage(server, runner, req, res, url, pagesDir, 404, routerShim.wrapWithRouterContext, void 0, void 0, reactStrictMode);
						return;
					}
					if (result && "props" in result) isSerializableProps(patternToNextFormat(route.pattern), "getServerSideProps", pageProps);
					if (!statusCode && res.statusCode !== 200) statusCode = res.statusCode;
					const headersAfterGSSP = res.getHeaders();
					for (const [key, val] of Object.entries(headersAfterGSSP)) {
						if (headersBeforeGSSP.has(key) || val == null) continue;
						res.removeHeader(key);
						if (Array.isArray(val)) gsspExtraHeaders[key] = val.map(String);
						else gsspExtraHeaders[key] = String(val);
					}
					if (!Object.keys(gsspExtraHeaders).some((k) => k.toLowerCase() === "cache-control")) gsspExtraHeaders["Cache-Control"] = NEVER_CACHE_CONTROL;
				}
				const responseHeaders = typeof res.getHeaders === "function" ? res.getHeaders() : void 0;
				const scriptNonce = getScriptNonceFromNodeHeaderSources(req.headers, responseHeaders);
				let earlyFontLinkHeader = "";
				try {
					const earlyPreloads = [];
					const fontGoogleEarly = await importModule(runner, "next/font/google");
					if (typeof fontGoogleEarly.getSSRFontPreloads === "function") earlyPreloads.push(...fontGoogleEarly.getSSRFontPreloads());
					const fontLocalEarly = await importModule(runner, "next/font/local");
					if (typeof fontLocalEarly.getSSRFontPreloads === "function") earlyPreloads.push(...fontLocalEarly.getSSRFontPreloads());
					if (earlyPreloads.length > 0) earlyFontLinkHeader = earlyPreloads.map((p) => `<${p.href}>; rel=preload; as=font; type=${p.type}; crossorigin`).join(", ");
				} catch {}
				if (typeof pageModule.getStaticProps === "function" && !isFallbackRender) {
					const cacheKey = pagesIsrCacheKey(url.split("?")[0]);
					const cached = await isrGet(cacheKey);
					const isOnDemandRevalidate = isOnDemandRevalidateRequest(req.headers[PRERENDER_REVALIDATE_HEADER]);
					const previewData = requestPreviewData;
					staticPropsPreviewData = previewData;
					const previewContext = previewData === false ? {} : {
						draftMode: true,
						preview: true,
						previewData
					};
					if (!isOnDemandRevalidate && cached && !cached.isStale && cached.value.value?.kind === "PAGES" && !cached.value.value.generatedFromDataRequest && !scriptNonce && !isDataReq && previewData === false) {
						const cachedHtml = cached.value.value.html;
						const transformedHtml = await server.transformIndexHtml(url, cachedHtml);
						const { cacheControl: hitCacheControl } = decideIsr({
							cacheState: "HIT",
							kind: "dev",
							revalidateSeconds: getRevalidateDuration(cacheKey) ?? 60
						});
						const hitHeaders = {
							"Content-Type": "text/html; charset=utf-8",
							...buildCacheStateHeaders("HIT"),
							"Cache-Control": hitCacheControl
						};
						if (earlyFontLinkHeader) hitHeaders["Link"] = earlyFontLinkHeader;
						res.writeHead(200, hitHeaders);
						res.end(transformedHtml);
						return;
					}
					if (!isOnDemandRevalidate && cached && cached.isStale && cached.value.value?.kind === "PAGES" && !cached.value.value.generatedFromDataRequest && !scriptNonce && !isDataReq && previewData === false) {
						const cachedHtml = cached.value.value.html;
						const transformedHtml = await server.transformIndexHtml(url, cachedHtml);
						triggerBackgroundRegeneration(cacheKey, async () => {
							return runWithRequestContext(createRequestContext({
								executionContext: null,
								ssrContext: {
									pathname: patternToNextFormat(route.pattern),
									query,
									asPath: requestAsPath,
									navigationIsReady,
									locale: locale ?? currentDefaultLocale,
									locales: i18nConfig?.locales,
									defaultLocale: currentDefaultLocale
								},
								i18nContext: i18nConfig ? {
									locale: locale ?? currentDefaultLocale,
									locales: i18nConfig.locales,
									defaultLocale: currentDefaultLocale,
									domainLocales,
									hostname: req.headers.host?.split(":", 1)[0]
								} : null
							}), async () => {
								ensureFetchPatch();
								let freshPageProps = {};
								let freshRenderProps = { pageProps: freshPageProps };
								let RegenApp = null;
								const appPath = path.join(pagesDir, "_app");
								if (findFileWithExtensions(appPath, matcher)) try {
									RegenApp = (await runner.import(appPath)).default ?? null;
								} catch {}
								if (RegenApp && hasPagesGetInitialProps(RegenApp)) {
									const regenReq = {
										url: req.url,
										headers: req.headers,
										method: req.method
									};
									const regenRes = {
										headersSent: false,
										writableEnded: false,
										statusCode: 200,
										getHeaders() {
											return {};
										}
									};
									const initialProps = await loadPagesGetInitialProps(RegenApp, {
										AppTree: (appTreeProps) => {
											const appTree = React.createElement(RegenApp, {
												...appTreeProps,
												Component: pageModule.default,
												pageProps: appTreeProps.pageProps,
												router: routerShim.default
											});
											return typeof routerShim.wrapWithRouterContext === "function" ? routerShim.wrapWithRouterContext(appTree) : appTree;
										},
										Component: pageModule.default,
										router: routerShim.default,
										ctx: {
											req: regenReq,
											res: regenRes,
											pathname: patternToNextFormat(route.pattern),
											query,
											asPath: requestAsPath,
											locale: locale ?? currentDefaultLocale,
											locales: i18nConfig?.locales,
											defaultLocale: currentDefaultLocale
										}
									});
									if (regenRes.headersSent || regenRes.writableEnded) return;
									if (initialProps) {
										freshRenderProps = initialProps;
										freshPageProps = isUnknownRecord(initialProps.pageProps) ? initialProps.pageProps : {};
									}
								}
								const freshResult = await pageModule.getStaticProps({
									params: userFacingParams,
									locale: locale ?? currentDefaultLocale,
									locales: i18nConfig?.locales,
									defaultLocale: currentDefaultLocale,
									revalidateReason: "stale"
								});
								if (freshResult && "props" in freshResult) {
									const revalidate = typeof freshResult.revalidate === "number" ? freshResult.revalidate : cached.value.cacheControl?.revalidate ?? 0;
									if (revalidate > 0) {
										freshPageProps = {
											...freshPageProps,
											...freshResult.props
										};
										freshRenderProps = {
											...freshRenderProps,
											pageProps: freshPageProps
										};
										if (typeof routerShim.setSSRContext === "function") routerShim.setSSRContext({
											pathname: patternToNextFormat(route.pattern),
											query,
											asPath: requestAsPath,
											navigationIsReady,
											locale: locale ?? currentDefaultLocale,
											locales: i18nConfig?.locales,
											defaultLocale: currentDefaultLocale,
											domainLocales
										});
										if (i18nConfig) {
											await runner.import("vinext/i18n-state");
											const i18nCtx = await importModule(runner, "vinext/i18n-context");
											if (typeof i18nCtx.setI18nContext === "function") i18nCtx.setI18nContext({
												locale: locale ?? currentDefaultLocale,
												locales: i18nConfig.locales,
												defaultLocale: currentDefaultLocale,
												domainLocales,
												hostname: req.headers.host?.split(":", 1)[0]
											});
										}
										let el = RegenApp ? React.createElement(RegenApp, {
											...freshRenderProps,
											Component: pageModule.default,
											pageProps: freshRenderProps.pageProps,
											router: routerShim.default
										}) : React.createElement(pageModule.default, freshPageProps);
										if (routerShim.wrapWithRouterContext) el = routerShim.wrapWithRouterContext(el);
										const freshBody = await renderIsrPassToStringAsync(withScriptNonce(el, scriptNonce));
										const viteRoot = server.config.root;
										const viteBase = server.config.base;
										const regenPageUrl = createPagesDevModuleUrl(viteRoot, route.filePath, viteBase);
										const regenAppUrl = RegenApp ? createPagesDevModuleUrl(viteRoot, path.join(pagesDir, "_app"), viteBase) : null;
										const freshPagesNextData = {
											...pagesNextData,
											__vinext: {
												...pagesNextData.__vinext,
												pageModuleUrl: regenPageUrl,
												appModuleUrl: regenAppUrl,
												hasMiddleware,
												routeUrl: requestAsPath
											}
										};
										const freshHtml = `<!DOCTYPE html><html><head></head><body><div id="__next">${freshBody}</div>${`<script id="__NEXT_DATA__" type="application/json">${safeJsonStringify({
											props: freshRenderProps,
											page: patternToNextFormat(route.pattern),
											query: params,
											buildId: process.env.__VINEXT_BUILD_ID,
											isFallback: false,
											locale: locale ?? currentDefaultLocale,
											locales: i18nConfig?.locales,
											defaultLocale: currentDefaultLocale,
											domainLocales,
											...freshPagesNextData
										})}<\/script>`}\n  ${cachedHtml.match(/<script type="module">[\s\S]*?<\/script>/)?.[0] ?? ""}</body></html>`;
										await isrSet(cacheKey, buildPagesCacheValue(freshHtml, freshRenderProps), revalidate);
										setRevalidateDuration(cacheKey, revalidate);
									}
								}
							});
						}, {
							routerKind: "Pages Router",
							routePath: route.pattern,
							routeType: "render"
						});
						const { cacheControl: staleCacheControl } = decideIsr({
							cacheState: "STALE",
							kind: "dev",
							revalidateSeconds: getRevalidateDuration(cacheKey) ?? 60
						});
						const staleHeaders = {
							"Content-Type": "text/html; charset=utf-8",
							...buildCacheStateHeaders("STALE"),
							"Cache-Control": staleCacheControl
						};
						if (earlyFontLinkHeader) staleHeaders["Link"] = earlyFontLinkHeader;
						res.writeHead(200, staleHeaders);
						res.end(transformedHtml);
						return;
					}
					const context = {
						params: userFacingParams,
						locale: locale ?? currentDefaultLocale,
						locales: i18nConfig?.locales,
						defaultLocale: currentDefaultLocale,
						revalidateReason: isOnDemandRevalidate ? "on-demand" : "stale",
						...previewContext
					};
					const generatedPageData = !isOnDemandRevalidate && previewData === false && cached?.isStale === false && cached?.value.value?.kind === "PAGES" && cached.value.value.generatedFromDataRequest && isUnknownRecord(cached.value.value.pageData) ? cached.value.value.pageData : null;
					if (!generatedPageData && await loadAppInitialProps()) return;
					const result = generatedPageData ? null : await pageModule.getStaticProps(context);
					if (generatedPageData) {
						renderProps = generatedPageData;
						pageProps = isUnknownRecord(renderProps.pageProps) ? renderProps.pageProps : {};
					}
					if (result && "props" in result) {
						pageProps = {
							...pageProps,
							...await Promise.resolve(result.props)
						};
						renderProps = {
							...renderProps,
							pageProps
						};
					}
					if (result && "redirect" in result) {
						writeGsspRedirect(res, result.redirect, isDataReq, renderProps);
						return;
					}
					if (result && "notFound" in result && result.notFound) {
						applyDevPagesPreviewResponse(res, requestPreview);
						if (isDataReq) {
							const deploymentId = process.env.__VINEXT_DEPLOYMENT_ID || process.env.NEXT_DEPLOYMENT_ID;
							const notFoundHeaders = { "Content-Type": "application/json" };
							if (deploymentId) notFoundHeaders[NEXTJS_DEPLOYMENT_ID_HEADER] = deploymentId;
							res.writeHead(404, notFoundHeaders);
							res.end("{}");
							return;
						}
						await renderErrorPage(server, runner, req, res, url, pagesDir, 404, routerShim.wrapWithRouterContext, void 0, void 0, reactStrictMode);
						return;
					}
					if (result && "props" in result) isSerializableProps(patternToNextFormat(route.pattern), "getStaticProps", pageProps);
					if (previewData === false && typeof result?.revalidate === "number" && result.revalidate > 0) isrRevalidateSeconds = result.revalidate;
					else if (previewData === false && cached?.value.value?.kind === "PAGES" && cached.value.value.generatedFromDataRequest) isrRevalidateSeconds = cached.value.cacheControl?.revalidate ?? 31536e3;
				}
				if (typeof pageModule.getServerSideProps !== "function" && typeof pageModule.getStaticProps !== "function" && hasAppGetInitialProps) {
					if (await loadAppInitialProps()) return;
				}
				if (typeof pageModule.getServerSideProps !== "function" && typeof pageModule.getStaticProps !== "function" && !hasAppGetInitialProps) {
					const initialProps = await loadPagesGetInitialProps(PageComponent, {
						req,
						res,
						pathname: patternToNextFormat(route.pattern),
						query,
						asPath: requestAsPath,
						locale: locale ?? currentDefaultLocale,
						locales: i18nConfig?.locales,
						defaultLocale: currentDefaultLocale
					});
					if (res.headersSent || res.writableEnded) return;
					if (initialProps) {
						pageProps = {
							...pageProps,
							...initialProps
						};
						renderProps = {
							...renderProps,
							pageProps
						};
					}
				}
				if (isDataReq) {
					if (shouldPersistFallbackData && staticPropsPreviewData === false) {
						const cacheKey = pagesIsrCacheKey(url.split("?")[0]);
						const revalidateSeconds = isrRevalidateSeconds ?? 31536e3;
						await isrSet(cacheKey, {
							kind: "PAGES",
							html: "",
							pageData: renderProps,
							generatedFromDataRequest: true,
							headers: void 0,
							status: void 0
						}, revalidateSeconds);
						setRevalidateDuration(cacheKey, revalidateSeconds);
					}
					const dataHeaders = { "Content-Type": "application/json" };
					if ((statusCode ?? 200) === 200) dataHeaders["x-nextjs-matched-path"] = `${locale ? `/${locale}` : ""}${patternToNextFormat(route.pattern)}`;
					if (gsspExtraHeaders) for (const [k, v] of Object.entries(gsspExtraHeaders)) dataHeaders[k] = v;
					applyDevPagesPreviewHeaders(dataHeaders, requestPreview);
					const dataRoutePattern = patternToNextFormat(route.pattern);
					if (dataRoutePattern !== "/_error" && dataRoutePattern !== "/500") {
						const deploymentId = process.env.__VINEXT_DEPLOYMENT_ID || process.env.NEXT_DEPLOYMENT_ID;
						if (deploymentId) dataHeaders[NEXTJS_DEPLOYMENT_ID_HEADER] = deploymentId;
					}
					res.writeHead(statusCode ?? 200, dataHeaders);
					res.end(JSON.stringify(renderProps));
					_renderEnd = now();
					return;
				}
				const createElement = React.createElement;
				let element;
				const wrapWithRouterContext = routerShim.wrapWithRouterContext;
				if (AppComponent) element = createElement(AppComponent, {
					...renderProps,
					Component: PageComponent,
					pageProps: renderProps.pageProps,
					router: routerShim.default
				});
				else element = createElement(PageComponent, pageProps);
				if (wrapWithRouterContext) element = wrapWithRouterContext(element);
				const headShim = await importModule(runner, "next/head");
				if (typeof headShim.resetSSRHead === "function") headShim.resetSSRHead();
				const dynamicShim = await importModule(runner, "next/dynamic");
				if (typeof dynamicShim.flushPreloads === "function") await dynamicShim.flushPreloads();
				const nonceAttr = createNonceAttribute(scriptNonce);
				let fontHeadHTML = "";
				const assetHeadHTML = await collectDevInitialStylesheetHeadHTML(server, runner, [AppComponent ? findFileWithExts(pagesDir, "_app", matcher) : null, route.filePath], nonceAttr);
				const allFontStyles = [];
				const allFontPreloads = [];
				try {
					const fontGoogle = await importModule(runner, "next/font/google");
					if (typeof fontGoogle.getSSRFontLinks === "function") {
						const fontUrls = fontGoogle.getSSRFontLinks();
						for (const fontUrl of fontUrls) {
							const safeFontUrl = fontUrl.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
							fontHeadHTML += `<link rel="stylesheet"${nonceAttr} href="${safeFontUrl}" />\n  `;
						}
					}
					if (typeof fontGoogle.getSSRFontStyles === "function") allFontStyles.push(...fontGoogle.getSSRFontStyles());
					if (typeof fontGoogle.getSSRFontPreloads === "function") allFontPreloads.push(...fontGoogle.getSSRFontPreloads());
				} catch {}
				try {
					const fontLocal = await importModule(runner, "next/font/local");
					if (typeof fontLocal.getSSRFontStyles === "function") allFontStyles.push(...fontLocal.getSSRFontStyles());
					if (typeof fontLocal.getSSRFontPreloads === "function") allFontPreloads.push(...fontLocal.getSSRFontPreloads());
				} catch {}
				for (const { href, type } of allFontPreloads) {
					const safeHref = href.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
					const safeType = type.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
					fontHeadHTML += `<link rel="preload"${nonceAttr} href="${safeHref}" as="font" type="${safeType}" crossorigin />\n  `;
				}
				if (allFontStyles.length > 0) fontHeadHTML += `<style data-vinext-fonts${nonceAttr}>${allFontStyles.join("\n")}</style>\n  `;
				const viteRoot = server.config.root;
				const viteBase = server.config.base;
				const pageModuleUrl = createPagesDevModuleUrl(viteRoot, route.filePath, viteBase);
				const pageModuleSource = createPagesDevModuleUrl(viteRoot, route.filePath, "/");
				const appModuleUrl = AppComponent ? createPagesDevModuleUrl(viteRoot, path.join(pagesDir, "_app"), viteBase) : null;
				const appModuleSource = AppComponent ? createPagesDevModuleUrl(viteRoot, path.join(pagesDir, "_app"), "/") : null;
				const serializedPagesNextData = {
					...pagesNextData,
					__vinext: {
						...pagesNextData.__vinext,
						pageModuleUrl,
						appModuleUrl,
						hasMiddleware,
						routeUrl: requestAsPath
					}
				};
				const hydrationScript = createPagesDevHydrationScript({
					appModuleSource,
					pageModuleSource,
					reactStrictMode: reactStrictMode === true,
					replaceFallbackRoute: true,
					scriptNonce
				});
				const nextDataScript = `<script id="__NEXT_DATA__" type="application/json"${nonceAttr}>${safeJsonStringify({
					props: renderProps,
					page: patternToNextFormat(route.pattern),
					query: isFallbackRender ? {} : params,
					buildId: process.env.__VINEXT_BUILD_ID,
					isFallback: isFallbackRender,
					locale: locale ?? currentDefaultLocale,
					locales: i18nConfig?.locales,
					defaultLocale: currentDefaultLocale,
					domainLocales,
					...serializedPagesNextData
				})}<\/script>`;
				const docPath = path.join(pagesDir, "_document");
				let DocumentComponent = null;
				if (findFileWithExtensions(docPath, matcher)) try {
					DocumentComponent = (await runner.import(docPath)).default ?? null;
				} catch {}
				const allScripts = `${nextDataScript}\n  ${createInlineScriptTag(`window.__VINEXT_PAGE_PATTERNS__=${safeJsonStringify(pagePatterns)}`, scriptNonce)}\n  ${hydrationScript}`;
				const extraHeaders = { ...gsspExtraHeaders };
				if (requestPreviewData === false && isrRevalidateSeconds) if (scriptNonce) extraHeaders["Cache-Control"] = NO_STORE_CACHE_CONTROL;
				else {
					extraHeaders["Cache-Control"] = buildMissIsrCacheControl(isrRevalidateSeconds);
					Object.assign(extraHeaders, buildCacheStateHeaders("MISS"));
				}
				applyDevPagesPreviewHeaders(extraHeaders, requestPreview);
				if (allFontPreloads.length > 0) extraHeaders["Link"] = allFontPreloads.map((p) => `<${p.href}>; rel=preload; as=font; type=${p.type}; crossorigin`).join(", ");
				await streamPageToResponse(res, withScriptNonce(element, scriptNonce), {
					url,
					server,
					fontHeadHTML,
					assetHeadHTML,
					scripts: allScripts,
					DocumentComponent,
					statusCode,
					extraHeaders,
					scriptNonce,
					documentContext: {
						pathname: patternToNextFormat(route.pattern),
						query,
						asPath: requestAsPath,
						...pagesNextData.autoExport === true ? {} : {
							req,
							res
						}
					},
					enhancePageElement: (renderPageOpts) => {
						let FinalApp = AppComponent;
						let FinalComp = PageComponent;
						if (renderPageOpts && typeof renderPageOpts.enhanceApp === "function" && FinalApp) FinalApp = renderPageOpts.enhanceApp(FinalApp);
						if (renderPageOpts && typeof renderPageOpts.enhanceComponent === "function") FinalComp = renderPageOpts.enhanceComponent(FinalComp);
						let enhancedElement;
						if (FinalApp) enhancedElement = createElement(FinalApp, {
							...renderProps,
							Component: FinalComp,
							pageProps
						});
						else enhancedElement = createElement(FinalComp, pageProps);
						if (wrapWithRouterContext) enhancedElement = wrapWithRouterContext(enhancedElement);
						return enhancedElement;
					},
					getHeadHTML: () => {
						const headHTML = typeof headShim.getSSRHeadHTML === "function" ? headShim.getSSRHeadHTML() : "";
						const traceHTML = getClientTraceMetadataHTML(clientTraceMetadata);
						return traceHTML ? `${headHTML}\n  ${traceHTML}` : headHTML;
					},
					setDocumentInitialHead: typeof headShim.setDocumentInitialHead === "function" ? headShim.setDocumentInitialHead : void 0,
					bufferBodyBeforeHeaders: true
				});
				_renderEnd = now();
				if (typeof routerShim.setSSRContext === "function") routerShim.setSSRContext(null);
				if (!scriptNonce && isrRevalidateSeconds !== null && isrRevalidateSeconds > 0) {
					let isrElement = AppComponent ? createElement(AppComponent, {
						...renderProps,
						Component: pageModule.default,
						pageProps
					}) : createElement(pageModule.default, pageProps);
					if (wrapWithRouterContext) isrElement = wrapWithRouterContext(isrElement);
					const isrHtml = `<!DOCTYPE html><html><head>${assetHeadHTML}</head><body><div id="__next">${await renderIsrPassToStringAsync(withScriptNonce(isrElement, scriptNonce))}</div>${allScripts}</body></html>`;
					const cacheKey = pagesIsrCacheKey(url.split("?")[0]);
					await isrSet(cacheKey, buildPagesCacheValue(isrHtml, pageProps), isrRevalidateSeconds);
					setRevalidateDuration(cacheKey, isrRevalidateSeconds);
				}
			} catch (e) {
				console.error(e);
				reportRequestError(e instanceof Error ? e : new Error(String(e)), {
					path: url,
					method: req.method ?? "GET",
					headers: Object.fromEntries(Object.entries(req.headers).filter(([k]) => !k.startsWith(":")).map(([k, v]) => [k, Array.isArray(v) ? v.join(", ") : String(v ?? "")]))
				}, {
					routerKind: "Pages Router",
					routePath: route.pattern,
					routeType: "render"
				}).catch(() => {});
				try {
					await renderErrorPage(server, runner, req, res, url, pagesDir, 500, void 0, matcher, e instanceof Error ? e : new Error(String(e)), reactStrictMode);
				} catch (fallbackErr) {
					res.statusCode = 500;
					res.end(`Internal Server Error: ${fallbackErr.message}`);
				}
			}
		});
	};
}
/**
* Render a custom error page (404.tsx, 500.tsx, or _error.tsx).
*
* Next.js resolution order:
* - 404: pages/404.tsx -> pages/_error.tsx -> default
* - 500: pages/500.tsx -> pages/_error.tsx -> default
* - other: pages/_error.tsx -> default
*/
async function renderErrorPage(server, runner, req, res, url, pagesDir, statusCode, wrapWithRouterContext, fileMatcher, err, reactStrictMode = false) {
	attachPagesRequestCookies(req);
	const matcher = fileMatcher ?? createValidFileMatcher();
	const candidates = statusCode === 404 ? ["404", "_error"] : statusCode === 500 ? ["500", "_error"] : ["_error"];
	for (const candidate of candidates) {
		let errorRouterShim = null;
		try {
			const errorAssetPath = findFileWithExts(pagesDir, candidate, matcher);
			if (!errorAssetPath && candidate !== "_error") continue;
			const ErrorComponent = (await importModule(runner, errorAssetPath ?? "next/error")).default;
			if (!ErrorComponent) continue;
			let AppComponent = null;
			const appPathErr = path.join(pagesDir, "_app");
			const appAssetPath = findFileWithExts(pagesDir, "_app", matcher);
			if (findFileWithExtensions(appPathErr, matcher)) try {
				AppComponent = (await importModule(runner, appAssetPath ?? appPathErr)).default ?? null;
			} catch {}
			const createElement = React.createElement;
			res.statusCode = statusCode;
			const errorPage = candidate === "_error" ? "/_error" : `/${candidate}`;
			const errorRouter = {
				pathname: errorPage,
				query: parseQueryString(url),
				asPath: url
			};
			try {
				errorRouterShim = await importModule(runner, "next/router");
				if (typeof errorRouterShim.setSSRContext === "function") errorRouterShim.setSSRContext({
					...errorRouter,
					navigationIsReady: true
				});
			} catch {}
			const serverRouter = errorRouterShim?.default ?? errorRouter;
			const wrapFn = wrapWithRouterContext ?? errorRouterShim?.wrapWithRouterContext;
			const initialErrorProps = await loadPagesGetInitialProps(ErrorComponent, {
				req,
				res,
				err,
				pathname: errorPage,
				query: errorRouter.query,
				asPath: url
			});
			if (res.headersSent || res.writableEnded) return;
			const errorProps = {
				...initialErrorProps,
				statusCode
			};
			let renderProps;
			if (AppComponent && hasPagesGetInitialProps(AppComponent)) {
				const appInitialProps = await loadPagesGetInitialProps(AppComponent, {
					AppTree: (appTreeProps) => {
						const appTree = createElement(AppComponent, {
							...appTreeProps,
							Component: ErrorComponent,
							router: serverRouter
						});
						return wrapFn ? wrapFn(appTree) : appTree;
					},
					Component: ErrorComponent,
					router: serverRouter,
					ctx: {
						req,
						res,
						err,
						pathname: errorPage,
						query: errorRouter.query,
						asPath: url
					}
				});
				if (res.headersSent || res.writableEnded) return;
				renderProps = appInitialProps ?? {};
			} else renderProps = { pageProps: errorProps };
			let DocumentComponent = null;
			const docPathErr = path.join(pagesDir, "_document");
			if (findFileWithExtensions(docPathErr, matcher)) try {
				DocumentComponent = (await importModule(runner, docPathErr)).default ?? null;
			} catch {}
			const createErrorElement = (FinalApp, FinalComponent) => {
				let errorElement = FinalApp ? createElement(FinalApp, {
					...renderProps,
					Component: FinalComponent,
					router: serverRouter
				}) : createElement(FinalComponent, errorProps);
				if (wrapFn) errorElement = wrapFn(errorElement);
				return errorElement;
			};
			const element = createErrorElement(AppComponent, ErrorComponent);
			const headShim = await importModule(runner, "next/head");
			if (typeof headShim.resetSSRHead === "function") headShim.resetSSRHead();
			const responseHeaders = typeof res.getHeaders === "function" ? res.getHeaders() : void 0;
			const scriptNonce = getScriptNonceFromNodeHeaderSources(req.headers, responseHeaders);
			const nonceAttr = createNonceAttribute(scriptNonce);
			const assetHeadHTML = await collectDevInitialStylesheetHeadHTML(server, runner, [appAssetPath, errorAssetPath], nonceAttr);
			const errorModuleSource = errorAssetPath ? createPagesDevModuleUrl(server.config.root, errorAssetPath, "/") : "next/error";
			const appModuleSource = appAssetPath ? createPagesDevModuleUrl(server.config.root, appAssetPath, "/") : null;
			const errorScripts = `${`<script id="__NEXT_DATA__" type="application/json"${nonceAttr}>${safeJsonStringify({
				props: renderProps,
				page: errorPage,
				query: parseQueryString(url),
				buildId: process.env.__VINEXT_BUILD_ID,
				isFallback: false
			})}<\/script>`}\n${createPagesDevHydrationScript({
				appModuleSource,
				forceRouterReady: true,
				normalizePageProps: false,
				pageModuleSource: errorModuleSource,
				reactStrictMode: reactStrictMode === true,
				scriptNonce,
				setPagePatternsFromNextData: true
			})}`;
			if (DocumentComponent) await streamPageToResponse(res, element, {
				url,
				server,
				fontHeadHTML: "",
				assetHeadHTML,
				scripts: errorScripts,
				DocumentComponent,
				statusCode,
				documentContext: {
					err,
					pathname: errorPage,
					query: parseQueryString(url),
					asPath: url,
					req,
					res
				},
				enhancePageElement: (renderPageOpts) => {
					let FinalApp = AppComponent;
					let FinalComponent = ErrorComponent;
					if (renderPageOpts.enhanceApp && FinalApp) FinalApp = renderPageOpts.enhanceApp(FinalApp);
					if (renderPageOpts.enhanceComponent) FinalComponent = renderPageOpts.enhanceComponent(FinalComponent);
					return createErrorElement(FinalApp, FinalComponent);
				},
				getHeadHTML: () => typeof headShim.getSSRHeadHTML === "function" ? headShim.getSSRHeadHTML() : "",
				setDocumentInitialHead: typeof headShim.setDocumentInitialHead === "function" ? headShim.setDocumentInitialHead : void 0
			});
			else {
				const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  ${assetHeadHTML}
</head>
<body>
  <div id="__next">${await renderToStringAsync(element)}</div>
  ${errorScripts}
</body>
</html>`;
				const transformedHtml = await server.transformIndexHtml(url, html);
				res.writeHead(statusCode, { "Content-Type": "text/html; charset=utf-8" });
				res.end(transformedHtml);
			}
			return;
		} catch {
			if (res.headersSent || res.writableEnded) return;
			continue;
		} finally {
			if (typeof errorRouterShim?.setSSRContext === "function") errorRouterShim.setSSRContext(null);
		}
	}
	if (statusCode === 404) {
		const defaultResponse = buildDefaultPagesNotFoundResponse();
		const headers = {};
		defaultResponse.headers.forEach((value, key) => {
			headers[key] = value;
		});
		res.writeHead(defaultResponse.status, headers);
		res.end(await defaultResponse.text());
		return;
	}
	res.writeHead(statusCode, { "Content-Type": "text/plain" });
	res.end(`${statusCode} - Internal Server Error`);
}
//#endregion
export { createSSRHandler, detectLocaleFromHeaders, extractLocaleFromUrl, parseCookieLocale };
