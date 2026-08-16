import { normalizePathnameForRouteMatch } from "../routing/utils.js";
import { NEXTJS_DEPLOYMENT_ID_HEADER } from "./headers.js";
import { isDangerousScheme } from "../shims/url-safety.js";
import { buildCacheStateHeaders } from "./cache-headers.js";
import { isUnknownRecord } from "../utils/record.js";
import { applyCdnResponseHeaders } from "./cache-control.js";
import { decideIsr } from "./isr-decision.js";
import { buildPagesCacheValue } from "./isr-cache.js";
import { normalizeStaticPathname } from "../routing/route-pattern.js";
import { buildPagesNextDataScript, etagMatches, generatePagesETag, isPagesStreamingBot, requestsNoCache } from "./pages-page-response.js";
import { createPagesGetInitialPropsRouter, hasPagesGetInitialProps, isResponseSent, loadPagesGetInitialProps } from "./pages-get-initial-props.js";
import { buildNextDataPropsJsonResponse } from "./pages-data-route.js";
import { isSerializableProps } from "./pages-serializable-props.js";
import { isBotUserAgent } from "../utils/html-limited-bots.js";
//#region src/server/pages-page-data.ts
function buildPagesDataNotFoundResponse(deploymentId) {
	const headers = { "Content-Type": "application/json" };
	if (deploymentId) headers[NEXTJS_DEPLOYMENT_ID_HEADER] = deploymentId;
	return new Response("{}", {
		status: 404,
		headers
	});
}
function buildPagesNotFoundResult(options) {
	if (options.isDataReq) return {
		kind: "response",
		response: buildPagesDataNotFoundResponse(options.deploymentId)
	};
	return { kind: "notFound" };
}
function resolvePagesRedirectStatus(redirect) {
	return redirect.statusCode != null ? redirect.statusCode : redirect.permanent ? 308 : 307;
}
function normalizePagesRenderProps(props) {
	return {
		...props,
		pageProps: props.pageProps
	};
}
/**
* Load `_app.getInitialProps` and return the normalized render props and the
* extracted `pageProps`. This is shared between the foreground render path and
* the stale-while-revalidate background regeneration path so both produce the
* same full props envelope (app-level props plus the page's `pageProps`).
*
* `getSharedReqRes` lets callers share the same mock req/res with other
* data-fetching steps (e.g. `getServerSideProps`) when they run in the same
* request context.
*/
async function loadPagesAppInitialRenderProps(options, getSharedReqRes) {
	let pageProps = {};
	let renderProps = { pageProps };
	if (!hasPagesGetInitialProps(options.AppComponent)) return {
		kind: "props",
		pageProps,
		renderProps
	};
	const { req, res, responsePromise } = getSharedReqRes();
	const initialProps = await loadPagesGetInitialProps(options.AppComponent, {
		AppTree: options.createAppTree ?? options.createPageElement,
		Component: options.pageModule.default,
		router: options.router ?? createPagesGetInitialPropsRouter(options.routePattern, options.query, options.asPath ?? options.routeUrl),
		ctx: {
			req,
			res,
			err: options.err,
			pathname: options.routePattern,
			query: options.query,
			asPath: options.asPath ?? options.routeUrl,
			locale: options.i18n.locale,
			locales: options.i18n.locales,
			defaultLocale: options.i18n.defaultLocale
		}
	});
	if (isResponseSent(res)) return {
		kind: "response",
		response: responsePromise
	};
	if (initialProps) {
		renderProps = normalizePagesRenderProps(initialProps);
		pageProps = isUnknownRecord(renderProps.pageProps) ? renderProps.pageProps : {};
	}
	return {
		kind: "props",
		pageProps,
		renderProps
	};
}
/**
* Build the response for a `getServerSideProps` / `getStaticProps`
* `{ redirect }` result.
*
* For an HTML page request we emit a real HTTP redirect (`Location` header) so
* a hard navigation lands on the destination.
*
* For a `/_next/data/<buildId>/<page>.json` request (a client-side navigation)
* we must NOT emit an HTTP redirect: the client's `fetch()` would transparently
* follow it to the destination's HTML, which is not a valid data envelope and
* would force a hard reload (and console error noise). Instead we mirror
* Next.js and return a 200 JSON envelope carrying `__N_REDIRECT` /
* `__N_REDIRECT_STATUS` inside `pageProps`. The client router detects these
* markers and performs a fresh client navigation to the destination, which
* supersedes (cancels) the in-flight navigation.
*
* Ported from Next.js: `packages/next/src/server/render.tsx` — the
* `__N_REDIRECT` / `__N_REDIRECT_STATUS` props assignment for gSSP/gSP
* redirects (search `__N_REDIRECT`), consumed in
* `packages/next/src/shared/lib/router/router.ts` (`pageProps.__N_REDIRECT`).
*/
function buildPagesRedirectResponse(redirect, options, props = { pageProps: {} }) {
	const destination = options.sanitizeDestination(redirect.destination);
	if (isDangerousScheme(destination)) {
		const headers = new Headers({
			"Cache-Control": "private, no-cache, no-store, max-age=0, must-revalidate",
			"Content-Type": "text/plain; charset=utf-8"
		});
		if (options.deploymentId) headers.set(NEXTJS_DEPLOYMENT_ID_HEADER, options.deploymentId);
		return new Response("Invalid redirect destination", {
			status: 500,
			headers
		});
	}
	if (options.isDataReq) {
		const init = { headers: {} };
		if (options.deploymentId) init.headers[NEXTJS_DEPLOYMENT_ID_HEADER] = options.deploymentId;
		return buildNextDataPropsJsonResponse({
			...props,
			pageProps: {
				...isUnknownRecord(props.pageProps) ? props.pageProps : {},
				__N_REDIRECT: destination,
				__N_REDIRECT_STATUS: resolvePagesRedirectStatus(redirect)
			}
		}, options.safeJsonStringify, init);
	}
	return new Response(null, {
		status: resolvePagesRedirectStatus(redirect),
		headers: { Location: destination }
	});
}
function getPagesRouteParams(routePattern) {
	return routePattern.split("/").map((segment) => {
		const optionalCatchAll = segment.match(/^\[\[\.\.\.(.+)\]\]$/);
		if (optionalCatchAll) return {
			key: optionalCatchAll[1],
			repeat: true,
			optional: true
		};
		const requiredCatchAll = segment.match(/^\[\.\.\.(.+)\]$/);
		if (requiredCatchAll) return {
			key: requiredCatchAll[1],
			repeat: true,
			optional: false
		};
		const dynamic = segment.match(/^\[(.+)\]$/);
		if (dynamic) return {
			key: dynamic[1],
			repeat: false,
			optional: false
		};
		return null;
	}).filter((param) => param !== null);
}
function matchesPagesStaticPath(pathEntry, params, routeParams, routeUrl) {
	if (typeof pathEntry === "string") return normalizePathnameForRouteMatch(normalizeStaticPathname(pathEntry)) === normalizePathnameForRouteMatch(normalizeStaticPathname(routeUrl));
	const entryParams = pathEntry.params;
	if (entryParams === void 0 || entryParams === null) return false;
	return routeParams.every(({ key, repeat, optional }) => {
		if (!Object.hasOwn(entryParams, key)) return false;
		let value = entryParams[key];
		if (optional && (value === null || value === void 0 || value === false)) value = [];
		if (repeat) {
			if (!Array.isArray(value) || !optional && value.length === 0) return false;
		} else if (typeof value !== "string") return false;
		const actual = params[key];
		if (Array.isArray(value)) {
			if (optional && value.length === 0 && actual === void 0) return true;
			return Array.isArray(actual) && value.join("/") === actual.join("/");
		}
		return String(value) === String(actual);
	});
}
function buildPagesCacheResponse(html, cacheState, fontLinkHeader, revalidateSeconds, expireSeconds, cacheControl, status) {
	const { cacheControl: cacheControlHeader } = decideIsr({
		cacheState,
		kind: "pages",
		revalidateSeconds: revalidateSeconds ?? 60,
		expireSeconds,
		cacheControlMeta: cacheControl
	});
	const headers = new Headers({
		"Content-Type": "text/html; charset=utf-8",
		...buildCacheStateHeaders(cacheState)
	});
	applyCdnResponseHeaders(headers, { cacheControl: cacheControlHeader });
	if (fontLinkHeader) headers.set("Link", fontLinkHeader);
	return new Response(html, {
		status: status ?? 200,
		headers
	});
}
/**
* For bot / crawler UAs, attach an ETag to a cached ISR response (HIT or
* STALE) so it is consistent with the fresh-MISS path, then check for a
* matching `If-None-Match`. When the check passes — and the request did NOT
* carry `Cache-Control: no-cache` — returns a 304 response; otherwise returns
* `null` so the caller can return the full response.
*
* Extracted to avoid duplicating the same three-line block across the HIT and
* STALE branches.
*/
function applyBotETagAndCheck(cachedResponse, html, options) {
	if (!options.userAgent || !isPagesStreamingBot(options.userAgent)) return null;
	const etag = generatePagesETag(html);
	cachedResponse.headers.set("ETag", etag);
	if (!requestsNoCache(options.requestCacheControl) && options.ifNoneMatch && etagMatches(etag, options.ifNoneMatch)) return {
		kind: "response",
		response: new Response(null, {
			status: 304,
			headers: cachedResponse.headers
		})
	};
	return null;
}
function rewritePagesCachedHtml(cachedHtml, freshBody, nextDataScript) {
	const bodyStart = cachedHtml.indexOf("<div id=\"__next\">");
	const contentStart = bodyStart >= 0 ? bodyStart + 17 : -1;
	const canonicalNextDataStart = cachedHtml.search(/<script\b(?=[^>]*\bid=["']__NEXT_DATA__["'])(?=[^>]*\btype=["']application\/json["'])[^>]*>/);
	const legacyNextDataStart = cachedHtml.indexOf("<script>window.__NEXT_DATA__");
	const nextDataStart = canonicalNextDataStart >= 0 ? canonicalNextDataStart : legacyNextDataStart;
	if (contentStart >= 0 && nextDataStart >= 0) {
		const region = cachedHtml.slice(contentStart, nextDataStart);
		const lastCloseDiv = region.lastIndexOf("</div>");
		const gap = lastCloseDiv >= 0 ? region.slice(lastCloseDiv + 6) : "";
		const nextDataEnd = cachedHtml.indexOf("<\/script>", nextDataStart) + 9;
		const tail = cachedHtml.slice(nextDataEnd);
		return cachedHtml.slice(0, contentStart) + freshBody + "</div>" + gap + nextDataScript + tail;
	}
	return "<!DOCTYPE html>\n<html>\n<head>\n</head>\n<body>\n  <div id=\"__next\">" + freshBody + "</div>\n  " + nextDataScript + "\n</body>\n</html>";
}
async function renderPagesIsrHtml(options) {
	const renderProps = options.props ?? { pageProps: options.pageProps };
	const freshBody = await options.renderIsrPassToStringAsync(options.createPageElement(renderProps));
	const nextDataScript = buildPagesNextDataScript({
		buildId: options.buildId,
		i18n: options.i18n,
		pageProps: options.pageProps,
		props: renderProps,
		params: options.params,
		routePattern: options.routePattern,
		safeJsonStringify: options.safeJsonStringify,
		nextData: options.nextData,
		vinext: options.vinext
	});
	return rewritePagesCachedHtml(options.cachedHtml, freshBody, nextDataScript);
}
async function resolvePagesPageData(options) {
	const userFacingParams = options.route.isDynamic ? options.params : null;
	let isFallback = false;
	let shouldPersistFallbackData = false;
	const previewData = options.isOnDemandRevalidate ? false : options.previewData ?? false;
	if (typeof options.pageModule.getStaticPaths === "function" && options.route.isDynamic) {
		const pathsResult = await options.pageModule.getStaticPaths({
			locales: options.i18n.locales ?? [],
			defaultLocale: options.i18n.defaultLocale ?? ""
		});
		const fallback = pathsResult?.fallback ?? false;
		const paths = pathsResult?.paths ?? [];
		const routeParams = getPagesRouteParams(options.routePattern);
		const isValidPath = paths.some((pathEntry) => matchesPagesStaticPath(pathEntry, options.params, routeParams, options.routeUrl));
		if (fallback === false && !isValidPath && previewData === false) return buildPagesNotFoundResult(options);
		const isBotRequest = !!options.userAgent && isBotUserAgent(options.userAgent, options.htmlLimitedBots);
		if (fallback === true && !isValidPath && !options.isDataReq && !isBotRequest && previewData === false) isFallback = true;
		shouldPersistFallbackData = fallback === true && !isValidPath && options.isDataReq === true;
	}
	let pageProps = {};
	let gsspRes = null;
	const previewContext = previewData === false ? {} : {
		draftMode: true,
		preview: true,
		previewData
	};
	let sharedReqRes = null;
	function getSharedReqRes() {
		sharedReqRes ??= options.createGsspReqRes();
		return sharedReqRes;
	}
	let renderProps = { pageProps };
	if (previewData !== false) renderProps.__N_PREVIEW = true;
	async function loadForegroundAppInitialRenderProps() {
		const result = await loadPagesAppInitialRenderProps(options, getSharedReqRes);
		if (result.kind === "response") return {
			kind: "response",
			response: await result.response
		};
		renderProps = result.renderProps;
		pageProps = result.pageProps;
		return null;
	}
	if (isFallback) {
		const pathname = options.routeUrl.split("?")[0];
		if ((await options.isrGet(options.isrCacheKey("pages", pathname)))?.value.value?.kind !== "PAGES") {
			const appShortCircuit = await loadForegroundAppInitialRenderProps();
			if (appShortCircuit) return appShortCircuit;
			pageProps = {};
			renderProps = {
				...renderProps,
				pageProps
			};
			return {
				kind: "render",
				documentReqRes: sharedReqRes,
				gsspRes: null,
				isrRevalidateSeconds: null,
				pageProps,
				props: renderProps,
				isFallback: true
			};
		}
	}
	if (typeof options.pageModule.getServerSideProps === "function") {
		const shortCircuit = await loadForegroundAppInitialRenderProps();
		if (shortCircuit) return shortCircuit;
		renderProps = {
			...renderProps,
			__N_SSP: true
		};
		const { req, res, responsePromise } = getSharedReqRes();
		const result = await options.pageModule.getServerSideProps({
			params: userFacingParams,
			req,
			res,
			query: options.query,
			resolvedUrl: options.resolvedUrl ?? options.routeUrl,
			locale: options.i18n.locale,
			locales: options.i18n.locales,
			defaultLocale: options.i18n.defaultLocale,
			...previewContext
		});
		if (isResponseSent(res)) return {
			kind: "response",
			response: await responsePromise
		};
		if (result?.props) {
			pageProps = {
				...pageProps,
				...await Promise.resolve(result.props)
			};
			renderProps = {
				...renderProps,
				pageProps
			};
		}
		if (result?.redirect) return {
			kind: "response",
			response: buildPagesRedirectResponse(result.redirect, options, renderProps)
		};
		if (result?.notFound) return buildPagesNotFoundResult(options);
		if (result?.props !== void 0 && options.validatePropsSerialization !== false) isSerializableProps(options.routePattern, "getServerSideProps", pageProps);
		gsspRes = res;
	}
	let isrRevalidateSeconds = null;
	if (typeof options.pageModule.getStaticProps === "function") {
		const pathname = options.routeUrl.split("?")[0];
		const cacheKey = options.isrCacheKey("pages", pathname);
		const cached = await options.isrGet(cacheKey);
		const cachedValue = cached?.value.value;
		if (!options.isOnDemandRevalidate && cached?.isStale === false && cachedValue?.kind === "PAGES" && !cachedValue.generatedFromDataRequest && cached && !cached.isStale && !options.scriptNonce && !options.isDataReq && previewData === false) {
			const hitResponse = buildPagesCacheResponse(cachedValue.html, "HIT", options.fontLinkHeader, void 0, options.expireSeconds, cached.value.cacheControl, cachedValue.status);
			const hitBotResult = applyBotETagAndCheck(hitResponse, cachedValue.html, options);
			if (hitBotResult) return hitBotResult;
			return {
				kind: "response",
				response: hitResponse
			};
		}
		if (!options.isOnDemandRevalidate && cachedValue?.kind === "PAGES" && !cachedValue.generatedFromDataRequest && cached && cached.isStale && !options.scriptNonce && !options.isDataReq && previewData === false) {
			options.triggerBackgroundRegeneration(cacheKey, async function() {
				return options.runInFreshUnifiedContext(async () => {
					options.applyRequestContexts();
					const freshAppResult = await loadPagesAppInitialRenderProps(options, () => options.createGsspReqRes());
					if (freshAppResult.kind === "response") return;
					let freshPageProps = freshAppResult.pageProps;
					let freshRenderProps = freshAppResult.renderProps;
					const freshResult = await options.pageModule.getStaticProps?.({
						params: userFacingParams,
						locale: options.i18n.locale,
						locales: options.i18n.locales,
						defaultLocale: options.i18n.defaultLocale,
						revalidateReason: "stale"
					});
					if (freshResult?.props) {
						freshPageProps = {
							...freshPageProps,
							...freshResult.props
						};
						freshRenderProps = {
							...freshRenderProps,
							pageProps: freshPageProps
						};
					}
					const freshRevalidateSeconds = typeof freshResult?.revalidate === "number" && freshResult.revalidate > 0 ? freshResult.revalidate : cached.value.cacheControl?.revalidate;
					if (freshResult?.props && freshRevalidateSeconds && freshRevalidateSeconds > 0) {
						const freshHtml = await renderPagesIsrHtml({
							buildId: options.buildId,
							cachedHtml: cachedValue.html,
							createPageElement: options.createPageElement,
							i18n: options.i18n,
							pageProps: freshPageProps,
							props: freshRenderProps,
							params: options.params,
							renderIsrPassToStringAsync: options.renderIsrPassToStringAsync,
							routePattern: options.routePattern,
							safeJsonStringify: options.safeJsonStringify,
							nextData: options.nextData,
							vinext: options.vinext
						});
						await options.isrSet(cacheKey, buildPagesCacheValue(freshHtml, freshRenderProps, options.statusCode), freshRevalidateSeconds, void 0, options.expireSeconds);
					}
				});
			}, {
				routerKind: "Pages Router",
				routePath: options.routePattern,
				routeType: "render"
			});
			const staleResponse = buildPagesCacheResponse(cachedValue.html, "STALE", options.fontLinkHeader, void 0, options.expireSeconds, cached.value.cacheControl, cachedValue.status);
			const staleBotResult = applyBotETagAndCheck(staleResponse, cachedValue.html, options);
			if (staleBotResult) return staleBotResult;
			return {
				kind: "response",
				response: staleResponse
			};
		}
		const generatedPageData = !options.isOnDemandRevalidate && previewData === false && cached?.isStale === false && cachedValue?.kind === "PAGES" && cachedValue.generatedFromDataRequest && isUnknownRecord(cachedValue.pageData) ? cachedValue.pageData : null;
		if (!generatedPageData) {
			const shortCircuit = await loadForegroundAppInitialRenderProps();
			if (shortCircuit) return shortCircuit;
		}
		const result = generatedPageData ? null : await options.pageModule.getStaticProps({
			params: userFacingParams,
			locale: options.i18n.locale,
			locales: options.i18n.locales,
			defaultLocale: options.i18n.defaultLocale,
			...previewContext,
			revalidateReason: options.isOnDemandRevalidate ? "on-demand" : options.isBuildTimePrerendering ? "build" : "stale"
		});
		if (generatedPageData) {
			renderProps = generatedPageData;
			pageProps = isUnknownRecord(renderProps.pageProps) ? renderProps.pageProps : {};
		}
		if (result?.props) {
			pageProps = {
				...pageProps,
				...result.props
			};
			renderProps = {
				...renderProps,
				pageProps
			};
		}
		if (result?.redirect) return {
			kind: "response",
			response: buildPagesRedirectResponse(result.redirect, options, renderProps)
		};
		if (result?.notFound) return buildPagesNotFoundResult(options);
		if (result?.props !== void 0 && options.validatePropsSerialization !== false) isSerializableProps(options.routePattern, "getStaticProps", pageProps);
		if (previewData === false && typeof result?.revalidate === "number" && result.revalidate > 0) isrRevalidateSeconds = result.revalidate;
		else if (previewData === false && cachedValue?.kind === "PAGES" && cachedValue.generatedFromDataRequest) isrRevalidateSeconds = cached?.value.cacheControl?.revalidate ?? 31536e3;
		if (shouldPersistFallbackData && previewData === false) {
			const revalidateSeconds = isrRevalidateSeconds ?? 31536e3;
			await options.isrSet(cacheKey, {
				kind: "PAGES",
				html: "",
				pageData: renderProps,
				generatedFromDataRequest: true,
				headers: void 0,
				status: void 0
			}, revalidateSeconds, void 0, options.expireSeconds);
		}
	}
	if (typeof options.pageModule.getServerSideProps !== "function" && typeof options.pageModule.getStaticProps !== "function" && hasPagesGetInitialProps(options.AppComponent)) {
		const shortCircuit = await loadForegroundAppInitialRenderProps();
		if (shortCircuit) return shortCircuit;
	}
	if (typeof options.pageModule.getServerSideProps !== "function" && typeof options.pageModule.getStaticProps !== "function" && !hasPagesGetInitialProps(options.AppComponent) && hasPagesGetInitialProps(options.pageModule.default)) {
		const { req, res, responsePromise } = getSharedReqRes();
		const initialProps = await loadPagesGetInitialProps(options.pageModule.default, {
			req,
			res,
			err: options.err,
			pathname: options.routePattern,
			query: options.query,
			asPath: options.asPath ?? options.routeUrl,
			locale: options.i18n.locale,
			locales: options.i18n.locales,
			defaultLocale: options.i18n.defaultLocale
		});
		if (isResponseSent(res)) return {
			kind: "response",
			response: await responsePromise
		};
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
	return {
		kind: "render",
		documentReqRes: sharedReqRes,
		gsspRes,
		isrRevalidateSeconds,
		pageProps,
		props: renderProps,
		isFallback: false
	};
}
//#endregion
export { getPagesRouteParams, matchesPagesStaticPath, renderPagesIsrHtml, resolvePagesPageData };
