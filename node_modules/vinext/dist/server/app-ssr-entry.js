import "./server-globals.js";
import { notFoundResponse } from "./http-error-responses.js";
import { isOpenRedirectShaped } from "./open-redirect.js";
import { AppElementsWire } from "./app-elements-wire.js";
import "./app-elements.js";
import { isPprFallbackShellAbortError } from "../shims/ppr-fallback-shell.js";
import { AppRouterContext } from "../shims/internal/app-router-context.js";
import { appendAssetDeploymentIdQuery } from "../utils/deployment-id.js";
import { ServerInsertedHTMLContext, clearServerInsertedHTML, getBfcacheIdMapContext, registerServerInsertedHTMLCallback, renderServerInsertedHTML, setNavigationContext } from "../shims/navigation-context-state.js";
import "../shims/navigation-server.js";
import { runWithNavigationContext } from "../shims/navigation-state.js";
import { withScriptNonce } from "../shims/script-nonce-context.js";
import { createInlineScriptTag, createNonceAttribute, escapeHtmlAttr, safeJsonStringify } from "./html.js";
import { getClientTraceMetadataHTML } from "./client-trace-metadata.js";
import { setPagesClientAssets } from "./pages-client-assets.js";
import DefaultGlobalError from "../shims/default-global-error.js";
import { BfcacheStateKeyMapContext, ElementsContext, Slot } from "../shims/slot.js";
import { createSsrErrorMetaRenderer } from "./app-ssr-error-meta.js";
import { createNavigationRuntimeRscMetadataScript, createRscEmbedTransform, createTickBufferedTransform, waitAtLeastOneReactRenderTask } from "./app-ssr-stream.js";
import { createInitialBfcacheMaps } from "./app-bfcache-identity.js";
import { RSC_FORM_STATE_GLOBAL } from "./app-browser-hydration.js";
import { createClientReferencePreloader } from "./app-client-reference-preloader.js";
import { deferUntilStreamConsumed } from "./defer-until-stream-consumed.js";
import { runWithRootParamsScope } from "../shims/root-params.js";
import { BeforeInteractiveContext } from "../shims/before-interactive-context.js";
import { renderBeforeInteractiveInlineScripts } from "./before-interactive-head.js";
import { createInitialDevServerErrorScript } from "./dev-initial-server-error.js";
import { ssrAppRouterInstance } from "./app-ssr-router-instance.js";
import { Fragment, createElement, use } from "react";
import { renderToReadableStream, renderToStaticMarkup } from "react-dom/server.edge";
import { preinitModule } from "react-dom";
import { createFromReadableStream } from "@vitejs/plugin-rsc/ssr";
import clientReferences from "virtual:vite-rsc/client-references";
import pagesClientAssets from "virtual:vinext-pages-client-assets";
//#region src/server/app-ssr-entry.ts
setPagesClientAssets(pagesClientAssets);
/**
* Default cap for the preload `Link` header, matching Next.js's
* `defaultConfig.reactMaxHeadersLength`. Used when no config value threads
* through (e.g. error-boundary renders) so React's internal cap agrees with
* the response-layer combine cap.
*/
const DEFAULT_REACT_MAX_HEADERS_LENGTH = 6e3;
function isReactDevelopmentRuntime() {
	if (process.env.NODE_ENV === "production") return false;
	if (process.env.NODE_ENV === "development") return true;
	return Function.prototype.toString.call(createElement).includes("getOwner");
}
function isStaticPrerenderModule(value) {
	return typeof value === "object" && value !== null && "prerender" in value && typeof value.prerender === "function";
}
async function loadStaticPrerender() {
	const staticRenderer = await import("react-dom/static.edge");
	if (isStaticPrerenderModule(staticRenderer)) return staticRenderer.prerender;
	if (isReactDevelopmentRuntime()) try {
		const [{ createRequire }, path] = await Promise.all([import("node:module"), import("node:path")]);
		const reactDomPackageJson = createRequire(import.meta.url).resolve("react-dom/package.json");
		const reactDomDir = path.dirname(reactDomPackageJson);
		const devRenderer = await import(
			/* @vite-ignore */
			path.join(reactDomDir, "cjs/react-dom-server.edge.development.js")
);
		if (isStaticPrerenderModule(devRenderer)) return devRenderer.prerender;
		const devRendererDefault = typeof devRenderer === "object" && devRenderer !== null && "default" in devRenderer && devRenderer.default;
		if (isStaticPrerenderModule(devRendererDefault)) return devRendererDefault.prerender;
		throw new Error("react-dom development renderer did not expose prerender().");
	} catch (error) {
		throw new Error("[vinext] Failed to load React static development renderer.", { cause: error });
	}
	throw new Error("[vinext] react-dom/static.edge did not expose prerender().");
}
function createUtf8Stream(html) {
	const encoder = new TextEncoder();
	return new ReadableStream({ start(controller) {
		controller.enqueue(encoder.encode(html));
		controller.close();
	} });
}
function buildBootstrapModuleScript(bootstrapModuleUrl, nonce) {
	if (!bootstrapModuleUrl) return "";
	return `<script type="module"${createNonceAttribute(nonce)} src="` + escapeHtmlAttr(bootstrapModuleUrl) + "\" id=\"_R_\" async=\"\"><\/script>";
}
function renderSsrErrorDocumentShell(bootstrapModuleUrl, nonce) {
	const html = renderToStaticMarkup(createElement(DefaultGlobalError, { error: null })).replace("<style>", "<style data-vinext-error-shell-style=\"\">");
	const bootstrapScript = buildBootstrapModuleScript(bootstrapModuleUrl, nonce);
	if (!bootstrapScript) return createUtf8Stream(`<!DOCTYPE html>${html}`);
	const documentClose = "</body></html>";
	if (!html.endsWith(documentClose)) return createUtf8Stream(`<!DOCTYPE html>${html}${bootstrapScript}`);
	return createUtf8Stream(`<!DOCTYPE html>${html.slice(0, -14)}${bootstrapScript}${documentClose}`);
}
const clientReferencePreloader = createClientReferencePreloader({
	getReferences() {
		return clientReferences;
	},
	getClientRequire() {
		return globalThis.__vite_rsc_client_require__;
	},
	onPreloadError(id, error) {
		if (process.env.NODE_ENV !== "production") console.warn("[vinext] failed to preload client ref:", id, error);
	}
});
const BfcacheIdMapContext = getBfcacheIdMapContext();
function ssrErrorDigest(input) {
	let hash = 5381;
	for (let i = input.length - 1; i >= 0; i--) hash = hash * 33 ^ input.charCodeAt(i);
	return (hash >>> 0).toString();
}
function getErrorMessage(error) {
	if (error instanceof Error) return error.message;
	if (typeof error === "string") return error;
	return Object.prototype.toString.call(error);
}
function renderInsertedHtml(insertedElements) {
	let insertedHTML = "";
	for (const element of insertedElements) try {
		insertedHTML += renderToStaticMarkup(createElement(Fragment, null, element));
	} catch {}
	return insertedHTML;
}
function renderFontHtml(fontData, nonce, options = {}) {
	if (!fontData) return "";
	let fontHTML = "";
	const nonceAttr = createNonceAttribute(nonce);
	const includeStyles = options.includeStyles ?? true;
	for (const url of fontData.links ?? []) fontHTML += `<link rel="stylesheet"${nonceAttr} href="${escapeHtmlAttr(appendAssetDeploymentIdQuery(url))}" />\n`;
	for (const preload of fontData.preloads ?? []) fontHTML += `<link rel="preload"${nonceAttr} href="${escapeHtmlAttr(appendAssetDeploymentIdQuery(preload.href))}" as="font" type="${escapeHtmlAttr(preload.type)}" crossorigin />\n`;
	if (includeStyles && fontData.styles && fontData.styles.length > 0) fontHTML += `<style data-vinext-fonts${nonceAttr}>${fontData.styles.join("\n")}</style>\n`;
	return fontHTML;
}
function hasInlineCssManifest(manifest) {
	return manifest !== void 0 && Object.keys(manifest).length > 0;
}
/**
* Extract the bootstrap module URL from the `import("...")` string that
* `import.meta.viteRsc.loadBootstrapScriptContent("index")` returns.
*
* The plugin-rsc helper returns the bootstrap as an inline call so we can
* inject it via `bootstrapScriptContent`. We instead pass the URL to
* React's `bootstrapModules` option so a real
* `<script type="module" src="…">` tag ends up in the streamed HTML —
* this exposes the URL to anything that reads `script.attribs.src` (e.g.
* the Next.js asset-prefix fixture test). The same URL also feeds the
* `<link rel="modulepreload">` we emit ahead of the bootstrap.
*
* Returns `undefined` when the helper produced no URL (older plugin-rsc
* versions, or a custom client entry that disables bootstrap content).
*/
function extractBootstrapModuleUrl(bootstrapScriptContent) {
	if (!bootstrapScriptContent) return void 0;
	return bootstrapScriptContent.match(/import\(["']([^"']+)["']\)/)?.[1] ?? void 0;
}
function buildModulePreloadHtml(bootstrapModuleUrl, nonce) {
	if (!bootstrapModuleUrl) return "";
	return `<link rel="modulepreload"${createNonceAttribute(nonce)} href="${escapeHtmlAttr(bootstrapModuleUrl)}" />\n`;
}
function buildHeadInjectionHtml(navContext, bootstrapModuleUrl, formState, insertedHTML, fontHTML, dynamicStaleTimeSeconds, scriptNonce) {
	const navPayload = {
		pathname: navContext.pathname,
		searchParams: [...navContext.searchParams.entries()]
	};
	return createInlineScriptTag(createNavigationRuntimeRscMetadataScript(navContext.params, navPayload, dynamicStaleTimeSeconds), scriptNonce) + (formState === null ? "" : createInlineScriptTag("self[" + safeJsonStringify(RSC_FORM_STATE_GLOBAL) + "]=" + safeJsonStringify(formState), scriptNonce)) + buildModulePreloadHtml(bootstrapModuleUrl, scriptNonce) + insertedHTML + fontHTML;
}
function requireNavigationContext(navContext) {
	if (!navContext) throw new Error("App SSR requires navigation context for BFCache state keys");
	return navContext;
}
async function handleSsr(rscStream, navContext, fontData, options) {
	return runWithNavigationContext(async () => {
		const ssrNavigationContext = requireNavigationContext(navContext);
		await clientReferencePreloader.preload();
		setNavigationContext(ssrNavigationContext);
		clearServerInsertedHTML();
		const cleanup = () => {
			setNavigationContext(null);
			clearServerInsertedHTML();
		};
		return runWithRootParamsScope(options?.rootParams ?? {}, async () => {
			try {
				let ssrStream;
				let rscEmbed;
				if (options?.sideStream) {
					ssrStream = rscStream;
					rscEmbed = createRscEmbedTransform(options.sideStream, options?.scriptNonce, options?.getInitialNavigationCacheMetadata);
					if (options.capturedRscDataRef) options.capturedRscDataRef.value = rscEmbed.getRawBuffer();
				} else {
					const [s1, s2] = rscStream.tee();
					ssrStream = s1;
					rscEmbed = createRscEmbedTransform(s2, options?.scriptNonce, options?.getInitialNavigationCacheMetadata);
				}
				let flightRoot = null;
				function VinextFlightRoot() {
					for (const moduleUrl of pagesClientAssets.appBootstrapPreinitModules ?? []) preinitModule(moduleUrl, {
						as: "script",
						nonce: options?.scriptNonce
					});
					if (!flightRoot) flightRoot = createFromReadableStream(ssrStream);
					const wireElements = use(flightRoot);
					const elements = AppElementsWire.decode(wireElements);
					const metadata = AppElementsWire.readMetadata(elements);
					const bfcacheMaps = createInitialBfcacheMaps({
						elements,
						metadata,
						pathname: ssrNavigationContext.pathname
					});
					const routeTree = createElement(ElementsContext.Provider, { value: elements }, createElement(Slot, { id: metadata.routeId }));
					const stateKeyTree = createElement(BfcacheStateKeyMapContext.Provider, { value: bfcacheMaps.stateKeys }, routeTree);
					return BfcacheIdMapContext ? createElement(BfcacheIdMapContext.Provider, { value: bfcacheMaps.bfcacheIds }, stateKeyTree) : stateKeyTree;
				}
				const flightRootElement = createElement(VinextFlightRoot);
				const root = AppRouterContext ? createElement(AppRouterContext.Provider, { value: ssrAppRouterInstance }, flightRootElement) : flightRootElement;
				const ssrTree = ServerInsertedHTMLContext ? createElement(ServerInsertedHTMLContext.Provider, { value: registerServerInsertedHTMLCallback }, root) : root;
				const beforeInteractiveInlineScripts = [];
				const registerBeforeInteractiveInlineScript = (script) => {
					beforeInteractiveInlineScripts.push(script);
				};
				const ssrRoot = withScriptNonce(createElement(BeforeInteractiveContext.Provider, { value: registerBeforeInteractiveInlineScript }, ssrTree), options?.scriptNonce);
				const bootstrapModuleUrl = extractBootstrapModuleUrl(await import.meta.viteRsc.loadBootstrapScriptContent("index"));
				const errorMetaRenderer = createSsrErrorMetaRenderer({ basePath: options?.basePath });
				const pprFallbackShellSignal = options?.pprFallbackShellSignal;
				let reactLinkHeader = "";
				const maxHeadersLength = options?.reactMaxHeadersLength ?? DEFAULT_REACT_MAX_HEADERS_LENGTH;
				const captureHeaders = maxHeadersLength > 0;
				const renderOptions = {
					bootstrapModules: bootstrapModuleUrl ? [bootstrapModuleUrl] : void 0,
					formState: options?.formState ?? null,
					nonce: options?.scriptNonce,
					onHeaders: captureHeaders ? (headers) => {
						const link = headers.get("Link");
						if (link) reactLinkHeader = link;
					} : void 0,
					maxHeadersLength: captureHeaders ? maxHeadersLength : void 0,
					onError(error) {
						if (pprFallbackShellSignal && isPprFallbackShellAbortError(error)) return;
						errorMetaRenderer.capture(error);
						if (error && typeof error === "object" && "digest" in error) return String(error.digest);
						if (process.env.NODE_ENV === "production" && error) return ssrErrorDigest(getErrorMessage(error) + (error instanceof Error ? error.stack ?? "" : ""));
					}
				};
				let htmlStream;
				let shellErrorRecovered = false;
				let shouldDelayInitialHtmlPull = false;
				if (pprFallbackShellSignal) {
					const prerender = await loadStaticPrerender();
					const htmlAbortController = new AbortController();
					const pendingHtml = prerender(ssrRoot, {
						...renderOptions,
						signal: htmlAbortController.signal
					});
					setTimeout(() => htmlAbortController.abort(), 0);
					htmlStream = (await pendingHtml).prelude;
				} else {
					let streamingHtmlStream;
					try {
						streamingHtmlStream = await renderToReadableStream(ssrRoot, { ...renderOptions });
						if (options?.waitForAllReady === true) await streamingHtmlStream.allReady;
						else shouldDelayInitialHtmlPull = true;
						htmlStream = streamingHtmlStream;
					} catch (error) {
						streamingHtmlStream?.cancel().catch(() => {});
						if (options?.fallbackToErrorDocumentOnShellError !== true || options?.waitForAllReady === true || typeof error?.digest === "string") throw error;
						shellErrorRecovered = true;
						htmlStream = renderSsrErrorDocumentShell(bootstrapModuleUrl, options?.scriptNonce);
					}
				}
				const inlineCssManifest = globalThis.__VINEXT_INLINE_CSS__;
				const fontStyles = fontData?.styles ?? [];
				const mergeFontStylesIntoInlineCss = fontStyles.length > 0 && hasInlineCssManifest(inlineCssManifest);
				const inlineCssFontStyles = mergeFontStylesIntoInlineCss ? fontStyles.join("\n") : "";
				const inlineCssFontStyleFallbackHTML = mergeFontStylesIntoInlineCss ? renderFontHtml({ styles: fontStyles }, options?.scriptNonce) : "";
				const fontHTML = renderFontHtml(fontData, options?.scriptNonce, { includeStyles: !mergeFontStylesIntoInlineCss });
				let traceMetaHTML = null;
				const getTraceMetaHTML = () => {
					if (traceMetaHTML === null) traceMetaHTML = getClientTraceMetadataHTML(options?.clientTraceMetadata);
					return traceMetaHTML;
				};
				let didInjectHeadHTML = false;
				const getInsertedHTML = () => {
					const insertedHTML = renderInsertedHtml(renderServerInsertedHTML());
					const errorMetaHTML = errorMetaRenderer.flush();
					const initialDevServerErrorHTML = createInitialDevServerErrorScript(options?.initialDevServerError, options?.scriptNonce);
					if (didInjectHeadHTML) return insertedHTML + errorMetaHTML;
					didInjectHeadHTML = true;
					return buildHeadInjectionHtml(ssrNavigationContext, bootstrapModuleUrl, options?.formState ?? null, insertedHTML + errorMetaHTML + getTraceMetaHTML() + initialDevServerErrorHTML, fontHTML, options?.dynamicStaleTimeSeconds, options?.scriptNonce);
				};
				const getBeforeInteractiveHeadHTML = () => renderBeforeInteractiveInlineScripts(beforeInteractiveInlineScripts);
				if (shouldDelayInitialHtmlPull) await waitAtLeastOneReactRenderTask();
				return {
					htmlStream: deferUntilStreamConsumed(htmlStream.pipeThrough(createTickBufferedTransform(rscEmbed, getInsertedHTML, getBeforeInteractiveHeadHTML, inlineCssManifest, inlineCssFontStyles, inlineCssFontStyleFallbackHTML, options?.scriptNonce)), cleanup),
					metadataReady: Promise.resolve(),
					capturedRscData: options?.capturedRscDataRef?.value ?? null,
					shellErrorRecovered,
					linkHeader: reactLinkHeader
				};
			} catch (error) {
				cleanup();
				throw error;
			}
		});
	});
}
var app_ssr_entry_default = { async fetch(request) {
	if (isOpenRedirectShaped(new URL(request.url).pathname)) return notFoundResponse();
	const result = await (await import.meta.viteRsc.loadModule("rsc", "index")).default(request);
	if (result instanceof Response) return result;
	if (result == null) return notFoundResponse();
	return new Response(String(result), { status: 200 });
} };
//#endregion
export { app_ssr_entry_default as default, handleSsr };
