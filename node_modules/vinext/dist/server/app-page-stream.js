import { isNavigationSignalError } from "../utils/navigation-signal.js";
import { VINEXT_RSC_VARY_HEADER } from "./app-rsc-cache-busting.js";
import { mergeMiddlewareResponseHeaders } from "./middleware-response-headers.js";
import { applyEdgeRuntimeHeader } from "./app-page-response.js";
import { deferUntilStreamConsumed } from "./defer-until-stream-consumed.js";
//#region src/server/app-page-stream.ts
function isAppSsrRenderResult(value) {
	return typeof value === "object" && value !== null && "htmlStream" in value && "metadataReady" in value;
}
const resolvedMetadataReady = Promise.resolve();
function normalizeAppSsrRenderResult(raw, fallbackCapturedRscData = null) {
	if (isAppSsrRenderResult(raw)) return raw;
	return {
		htmlStream: raw,
		metadataReady: resolvedMetadataReady,
		capturedRscData: fallbackCapturedRscData,
		shellErrorRecovered: false
	};
}
/**
* Combine the React-emitted preload `Link` header with vinext's font preload
* `Link` header, capping the result to `reactMaxHeadersLength`.
*
* React already caps its own portion, but vinext emits font preloads through a
* separate channel. Mirroring Next.js — where every preload flows through a
* single capped `onHeaders` callback — we cap the *combined* header here,
* keeping only whole entries that fit and dropping the rest once the limit is
* exceeded. `0` disables emission entirely (matches React); `undefined` falls
* back to the React default of 6000.
*
* React's hints (scripts/modules/styles) come first so that under a tight cap
* the render-critical entries survive and trailing font preloads are dropped
* first.
*/
function buildAppPageLinkHeader(reactLinkHeader, fontLinkHeader, maxHeadersLength) {
	const limit = typeof maxHeadersLength === "number" ? maxHeadersLength : 6e3;
	if (limit <= 0) return "";
	const entries = [];
	for (const source of [reactLinkHeader, fontLinkHeader]) {
		if (!source) continue;
		for (const entry of source.split(", ")) if (entry.length > 0) entries.push(entry);
	}
	let header = "";
	for (const entry of entries) {
		const next = header.length === 0 ? entry : `${header}, ${entry}`;
		if (next.length > limit) break;
		header = next;
	}
	return header;
}
function createAppPageFontData(options) {
	return {
		links: options.getLinks(),
		preloads: options.getPreloads(),
		styles: options.getStyles()
	};
}
async function renderAppPageHtmlStream(options) {
	const ssrOptions = {
		formState: options.formState ?? null,
		scriptNonce: options.scriptNonce,
		basePath: options.basePath,
		clientTraceMetadata: options.clientTraceMetadata,
		reactMaxHeadersLength: options.reactMaxHeadersLength,
		rootParams: options.rootParams,
		sideStream: options.sideStream,
		capturedRscDataRef: options.capturedRscDataRef,
		pprFallbackShellSignal: options.pprFallbackShellSignal,
		waitForAllReady: options.waitForAllReady,
		initialDevServerError: options.initialDevServerError,
		fallbackToErrorDocumentOnShellError: options.fallbackToErrorDocumentOnShellError ?? (options.waitForAllReady !== true && options.hasCustomGlobalError === false),
		dynamicStaleTimeSeconds: options.dynamicStaleTimeSeconds,
		getInitialNavigationCacheMetadata: options.getInitialNavigationCacheMetadata
	};
	return normalizeAppSsrRenderResult(await options.ssrHandler.handleSsr(options.rscStream, options.navigationContext, options.fontData, ssrOptions), options.capturedRscDataRef?.value ?? null);
}
async function renderAppPageHtmlResponse(options) {
	const { htmlStream } = await renderAppPageHtmlStream(options);
	const safeStream = deferUntilStreamConsumed(htmlStream, () => {
		options.clearRequestContext();
	});
	const headers = new Headers({
		"Content-Type": "text/html; charset=utf-8",
		Vary: VINEXT_RSC_VARY_HEADER
	});
	applyEdgeRuntimeHeader(headers, options.isEdgeRuntime);
	if (options.fontLinkHeader) headers.set("Link", options.fontLinkHeader);
	mergeMiddlewareResponseHeaders(headers, options.middlewareHeaders ?? null);
	return new Response(safeStream, {
		status: options.status,
		headers
	});
}
async function renderAppPageHtmlStreamWithRecovery(options) {
	try {
		const { htmlStream, metadataReady, capturedRscData, linkHeader, shellErrorRecovered } = normalizeAppSsrRenderResult(await options.renderHtmlStream());
		options.onShellRendered?.();
		return {
			htmlStream,
			response: null,
			metadataReady,
			capturedRscData,
			shellErrorRecovered: shellErrorRecovered === true,
			linkHeader
		};
	} catch (error) {
		const specialError = options.resolveSpecialError(error);
		if (specialError) return {
			htmlStream: null,
			response: await options.renderSpecialErrorResponse(specialError),
			metadataReady: resolvedMetadataReady,
			capturedRscData: null,
			shellErrorRecovered: false
		};
		const boundaryResponse = await options.renderErrorBoundaryResponse(error);
		if (boundaryResponse) return {
			htmlStream: null,
			response: boundaryResponse,
			metadataReady: resolvedMetadataReady,
			capturedRscData: null,
			shellErrorRecovered: false
		};
		throw error;
	}
}
function createAppPageRscErrorTracker(baseOnError) {
	let capturedError = null;
	let capturedSpecialError = null;
	return {
		getCapturedError() {
			return capturedError;
		},
		getCapturedSpecialError() {
			return capturedSpecialError;
		},
		onRenderError(error, requestInfo, errorContext) {
			if (isNavigationSignalError(error)) {
				if (capturedSpecialError === null) capturedSpecialError = error;
			} else capturedError = error;
			return baseOnError(error, requestInfo, errorContext);
		}
	};
}
//#endregion
export { buildAppPageLinkHeader, createAppPageFontData, createAppPageRscErrorTracker, deferUntilStreamConsumed, isAppSsrRenderResult, renderAppPageHtmlResponse, renderAppPageHtmlStream, renderAppPageHtmlStreamWithRecovery };
