import { getRequestExecutionContext } from "../shims/request-context.js";
import { reportRequestError } from "./instrumentation.js";
import { setCacheStateHeaders } from "./cache-headers.js";
import { BROWSER_REVALIDATE_CACHE_CONTROL, NEVER_CACHE_CONTROL, NO_STORE_CACHE_CONTROL, applyCdnResponseHeaders, shouldUseNextDeployCacheControl } from "./cache-control.js";
import { buildMissIsrCacheControl } from "./isr-decision.js";
import { fnv1a52 } from "../utils/hash.js";
import { encodeCacheTag } from "../utils/encode-cache-tag.js";
import { appendAssetDeploymentIdQuery } from "../utils/deployment-id.js";
import { withScriptNonce } from "../shims/script-nonce-context.js";
import { createNonceAttribute, escapeHtmlAttr } from "./html.js";
import { getClientTraceMetadataHTML } from "./client-trace-metadata.js";
import { readStreamAsText } from "../utils/text-stream.js";
import { loadUserDocumentInitialProps, runDocumentRenderPage } from "./pages-document-initial-props.js";
import { callDocumentGetInitialProps } from "./document-initial-head.js";
import React from "react";
//#region src/server/pages-page-response.ts
/**
* Crawlers that cannot handle streamed HTML: they read metadata only from
* the first network chunk, so streaming would give them an incomplete <head>.
* Pattern sourced from Next.js html-bots.ts (updated to match the canary).
*/
const HTML_LIMITED_BOT_UA_RE = /[\w-]+-Google|Google-[\w-]+|Chrome-Lighthouse|Slurp|DuckDuckBot|baiduspider|yandex|sogou|bitlybot|tumblr|vkShare|quora link preview|redditbot|ia_archiver|Bingbot|BingPreview|applebot|facebookexternalhit|facebookcatalog|Twitterbot|LinkedInBot|Slackbot|Discordbot|WhatsApp|SkypeUriPreview|Yeti|googleweblight/i;
/**
* Googlebot (the main search crawler) executes JavaScript via a headless
* browser, so it too cannot safely handle mid-stream HTML mutations.
* Matches "Googlebot" but NOT suffixed variants like "Googlebot-Image".
*/
const HEADLESS_BROWSER_BOT_UA_RE = /Googlebot(?!-)|Googlebot$/i;
/**
* Returns true when the User-Agent belongs to a bot or crawler that cannot
* reliably consume a streamed HTML response.
*/
function isPagesStreamingBot(userAgent) {
	return HEADLESS_BROWSER_BOT_UA_RE.test(userAgent) || HTML_LIMITED_BOT_UA_RE.test(userAgent);
}
function generatePagesETag(payload) {
	return "\"" + fnv1a52(payload).toString(36) + payload.length.toString(36) + "\"";
}
/**
* Mirrors Next.js `sendEtagResponse` semantics (weak/strong comparison).
*
* A weak ETag `W/"..."` matches both `W/"..."` and `"..."` in `If-None-Match`.
* A strong ETag `"..."` only matches the same strong token.
* `*` always matches.
*/
function etagMatches(etag, ifNoneMatch) {
	if (ifNoneMatch === "*") return true;
	const normalize = (t) => t.replace(/^W\//, "");
	const etagNorm = normalize(etag.trim());
	for (const token of ifNoneMatch.split(",")) if (normalize(token.trim()) === etagNorm) return true;
	return false;
}
/**
* Returns true when a request `Cache-Control` header asks to bypass the 304
* short-circuit. Mirrors the `fresh` package's check used by Next.js's
* `sendEtagResponse` (`/(?:^|,)\s*?no-cache\s*?(?:,|$)/`). Shared by the
* fresh-MISS bot path here and the ISR HIT/STALE paths in
* `pages-page-data.ts` so the two cannot drift.
*/
function requestsNoCache(cacheControl) {
	return /(?:^|,)\s*no-cache\s*(?:,|$)/.test(cacheControl ?? "");
}
function buildPagesFontHeadHtml(fontLinks, fontPreloads, fontStyles, scriptNonce) {
	let html = "";
	const nonceAttr = createNonceAttribute(scriptNonce);
	for (const link of fontLinks) html += `<link rel="stylesheet"${nonceAttr} href="${escapeHtmlAttr(appendAssetDeploymentIdQuery(link))}" />\n  `;
	for (const preload of fontPreloads) html += `<link rel="preload"${nonceAttr} href="${escapeHtmlAttr(appendAssetDeploymentIdQuery(preload.href))}" as="font" type="${escapeHtmlAttr(preload.type)}" crossorigin />\n  `;
	if (fontStyles.length > 0) html += `<style data-vinext-fonts${nonceAttr}>${fontStyles.join("\n")}</style>\n  `;
	return html;
}
function buildPagesNextDataScript(options) {
	const nextDataPayload = {
		props: options.props ?? { pageProps: options.pageProps },
		page: options.routePattern,
		query: options.isFallback === true ? {} : options.params,
		buildId: options.buildId,
		isFallback: options.isFallback === true
	};
	if (options.nextData) {
		for (const [key, value] of Object.entries(options.nextData)) if (value !== void 0) nextDataPayload[key] = value;
	}
	if (options.i18n.locales) {
		nextDataPayload.locale = options.i18n.locale;
		nextDataPayload.locales = options.i18n.locales;
		nextDataPayload.defaultLocale = options.i18n.defaultLocale;
		nextDataPayload.domainLocales = options.i18n.domainLocales;
	}
	if (options.vinext) nextDataPayload.__vinext = {
		...options.nextData?.__vinext,
		...options.vinext
	};
	return `<script id="__NEXT_DATA__" type="application/json"${createNonceAttribute(options.scriptNonce)}>${options.safeJsonStringify(nextDataPayload)}<\/script>`;
}
async function buildPagesShellHtml(bodyMarker, fontHeadHTML, nextDataScript, options) {
	if (options.DocumentComponent) {
		const docProps = options.resolvedDocProps ?? await loadUserDocumentInitialProps(options.DocumentComponent);
		const docElement = docProps ? React.createElement(options.DocumentComponent, docProps) : React.createElement(options.DocumentComponent);
		let html = await options.renderDocumentToString(docElement);
		html = html.replace("__NEXT_MAIN__", bodyMarker);
		if (options.ssrHeadHTML || options.assetTags || fontHeadHTML) html = html.replace("</head>", `  ${fontHeadHTML}${options.ssrHeadHTML}\n  ${options.assetTags}\n</head>`);
		html = html.replace("<!-- __NEXT_SCRIPTS__ -->", nextDataScript);
		if (!html.includes("__NEXT_DATA__")) html = html.replace("</body>", `  ${nextDataScript}\n</body>`);
		return html;
	}
	return `<!DOCTYPE html>
<html>
<head>
  ${fontHeadHTML}${options.ssrHeadHTML}\n  ${options.assetTags}\n</head>
<body>
  <div id="__next">${bodyMarker}</div>\n  ${nextDataScript}\n</body>
</html>`;
}
async function buildPagesCompositeStream(bodyStream, shellPrefix, shellSuffix) {
	const encoder = new TextEncoder();
	return new ReadableStream({ async start(controller) {
		controller.enqueue(encoder.encode(shellPrefix));
		const reader = bodyStream.getReader();
		try {
			for (;;) {
				const chunk = await reader.read();
				if (chunk.done) break;
				controller.enqueue(chunk.value);
			}
		} finally {
			reader.releaseLock();
		}
		controller.enqueue(encoder.encode(shellSuffix));
		controller.close();
	} });
}
async function reportPagesIsrCacheWriteError(error, cacheKey, routePattern) {
	console.error(`[vinext] Pages ISR cache write failed for ${cacheKey}:`, error);
	try {
		await reportRequestError(error instanceof Error ? error : new Error(String(error)), {
			path: cacheKey,
			method: "GET",
			headers: {}
		}, {
			routerKind: "Pages Router",
			routePath: routePattern,
			routeType: "render"
		});
	} catch {}
}
function schedulePagesIsrCacheWrite(options) {
	const cacheWritePromise = readStreamAsText(options.stream).then((bodyHtml) => options.setCache(options.cacheKey, {
		kind: "PAGES",
		html: options.shellPrefix + bodyHtml + options.shellSuffix,
		pageData: options.pageData,
		headers: void 0,
		status: options.status
	}, options.revalidateSeconds, void 0, options.expireSeconds)).catch((error) => reportPagesIsrCacheWriteError(error, options.cacheKey, options.routePattern));
	getRequestExecutionContext()?.waitUntil(cacheWritePromise);
}
function applyGsspHeaders(headers, gsspRes, statusCode) {
	if (!gsspRes) return statusCode ?? 200;
	const gsspHeaders = gsspRes.getHeaders();
	for (const key of Object.keys(gsspHeaders)) {
		const value = gsspHeaders[key];
		if (key.toLowerCase() === "set-cookie" && Array.isArray(value)) {
			for (const cookie of value) headers.append("set-cookie", String(cookie));
			continue;
		}
		if (Array.isArray(value)) {
			headers.set(key, value.join(", "));
			continue;
		}
		if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") headers.set(key, String(value));
	}
	headers.set("Content-Type", "text/html; charset=utf-8");
	return statusCode ?? gsspRes.statusCode;
}
async function renderPagesPageResponse(options) {
	const renderProps = options.props ?? { pageProps: options.pageProps };
	options.resetSSRHead?.();
	await options.flushPreloads?.();
	const fontHeadHTML = buildPagesFontHeadHtml(options.getFontLinks(), options.fontPreloads, options.getFontStyles(), options.scriptNonce);
	const nextDataScript = buildPagesNextDataScript({
		buildId: options.buildId,
		i18n: options.i18n,
		isFallback: options.isFallback,
		pageProps: options.pageProps,
		props: renderProps,
		params: options.params,
		routePattern: options.routePattern,
		safeJsonStringify: options.safeJsonStringify,
		scriptNonce: options.scriptNonce,
		nextData: options.nextData,
		vinext: options.vinext
	});
	const bodyMarker = "<!--VINEXT_STREAM_BODY-->";
	const documentRenderPage = await runDocumentRenderPage({
		DocumentComponent: options.DocumentComponent,
		enhancePageElement: options.enhancePageElement,
		renderToReadableStream: options.renderToReadableStream,
		renderStylesToString: async (element) => readStreamAsText(await options.renderToReadableStream(element)),
		scriptNonce: options.scriptNonce,
		context: {
			err: options.err,
			req: options.documentReqRes?.req,
			res: options.documentReqRes?.res,
			pathname: options.routePattern,
			query: options.query ?? options.params,
			asPath: options.routeUrl
		}
	});
	if (options.documentReqRes?.res.headersSent && options.documentReqRes.responsePromise) return options.documentReqRes.responsePromise;
	let bodyStream;
	if (documentRenderPage.status === "rendered") bodyStream = new ReadableStream({ start(controller) {
		controller.enqueue(new TextEncoder().encode(documentRenderPage.bodyHtml));
		controller.close();
	} });
	else {
		const pageElement = withScriptNonce(React.createElement(React.Fragment, null, options.createPageElement(renderProps)), options.scriptNonce);
		bodyStream = await options.renderToReadableStream(pageElement);
	}
	if (documentRenderPage.status === "skipped") await callDocumentGetInitialProps(options.DocumentComponent, options.setDocumentInitialHead);
	else options.setDocumentInitialHead?.(documentRenderPage.head);
	const headFromShim = options.getSSRHeadHTML?.() ?? "";
	const traceMetaHTML = getClientTraceMetadataHTML(options.clientTraceMetadata);
	let ssrHeadHTML = headFromShim;
	if (traceMetaHTML) ssrHeadHTML += `\n  ${traceMetaHTML}`;
	if (documentRenderPage.status === "rendered" && documentRenderPage.stylesHTML) ssrHeadHTML += `\n  ${documentRenderPage.stylesHTML}`;
	const shellHtml = await buildPagesShellHtml(bodyMarker, fontHeadHTML, nextDataScript, {
		assetTags: options.assetTags,
		DocumentComponent: options.DocumentComponent,
		renderDocumentToString: options.renderDocumentToString,
		ssrHeadHTML,
		resolvedDocProps: documentRenderPage.status === "skipped" ? null : documentRenderPage.docProps
	});
	options.clearSsrContext();
	const markerIndex = shellHtml.indexOf(bodyMarker);
	const shellPrefix = shellHtml.slice(0, markerIndex);
	const shellSuffix = shellHtml.slice(markerIndex + 25);
	const responseHeaders = new Headers({ "Content-Type": "text/html; charset=utf-8" });
	const finalStatus = applyGsspHeaders(responseHeaders, options.gsspRes ?? options.documentReqRes?.res ?? null, options.statusCode);
	let responseBodyStream = bodyStream;
	if (!options.scriptNonce && options.isrRevalidateSeconds !== null && options.isrRevalidateSeconds > 0) {
		const cacheBodyStreamPair = bodyStream.tee();
		responseBodyStream = cacheBodyStreamPair[0];
		const cacheBodyStream = cacheBodyStreamPair[1];
		const isrPathname = options.routeUrl.split("?")[0];
		schedulePagesIsrCacheWrite({
			cacheKey: options.isrCacheKey("pages", isrPathname),
			expireSeconds: options.expireSeconds,
			pageData: options.pageProps,
			revalidateSeconds: options.isrRevalidateSeconds,
			routePattern: options.routePattern,
			setCache: options.isrSet,
			shellPrefix,
			shellSuffix,
			status: finalStatus,
			stream: cacheBodyStream
		});
	}
	const compositeStream = await buildPagesCompositeStream(responseBodyStream, shellPrefix, shellSuffix);
	const userSetCacheControl = responseHeaders.has("Cache-Control");
	if (options.scriptNonce) responseHeaders.set("Cache-Control", NO_STORE_CACHE_CONTROL);
	else if (options.isrRevalidateSeconds) {
		const isrPathname = options.routeUrl.split("?")[0];
		const stem = isrPathname.endsWith("/") ? isrPathname.slice(0, -1) : isrPathname;
		applyCdnResponseHeaders(responseHeaders, {
			cacheControl: buildMissIsrCacheControl(options.isrRevalidateSeconds, options.expireSeconds),
			tags: [encodeCacheTag(`_N_T_${stem || "/"}`)]
		});
		setCacheStateHeaders(responseHeaders, "MISS");
	} else if (options.isStaticPropsRoute && shouldUseNextDeployCacheControl()) responseHeaders.set("Cache-Control", BROWSER_REVALIDATE_CACHE_CONTROL);
	else if (options.gsspRes && !userSetCacheControl) responseHeaders.set("Cache-Control", NEVER_CACHE_CONTROL);
	if (options.fontLinkHeader) responseHeaders.set("Link", options.fontLinkHeader);
	if (options.userAgent && isPagesStreamingBot(options.userAgent)) {
		const fullHtml = await readStreamAsText(compositeStream);
		const etag = generatePagesETag(fullHtml);
		responseHeaders.set("ETag", etag);
		if (!requestsNoCache(options.requestCacheControl) && options.ifNoneMatch && etagMatches(etag, options.ifNoneMatch)) return new Response(null, {
			status: 304,
			headers: responseHeaders
		});
		return new Response(fullHtml, {
			status: finalStatus,
			headers: responseHeaders
		});
	}
	return Object.assign(new Response(compositeStream, {
		status: finalStatus,
		headers: responseHeaders
	}), { __vinextStreamedHtmlResponse: true });
}
//#endregion
export { buildPagesNextDataScript, etagMatches, generatePagesETag, isPagesStreamingBot, renderPagesPageResponse, requestsNoCache };
