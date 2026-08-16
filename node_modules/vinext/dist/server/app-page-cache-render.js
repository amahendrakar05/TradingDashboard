import { consumeDynamicUsage, consumeInvalidDynamicUsageError } from "../shims/headers.js";
import { _consumeRequestScopedCacheLife } from "../shims/cache-request-state.js";
import { getCollectedFetchTags } from "../shims/fetch-cache.js";
import { readStreamAsText } from "../utils/text-stream.js";
import { buildAppPageFontLinkHeader, teeAppPageRscStreamForCapture } from "./app-page-execution.js";
import { consumeAppPageRenderObservationState, createAppPageHtmlOutputScope, createAppPageRenderObservation, createAppPageRscOutputScope } from "./app-page-render-observation.js";
import { buildAppPageLinkHeader, isAppSsrRenderResult } from "./app-page-stream.js";
import { buildAppPageTags } from "./implicit-tags.js";
//#region src/server/app-page-cache-render.ts
/**
* Render an App page element to HTML (and optionally its RSC payload) for cache
* storage. Combines the RSC stream, SSR handler, observation consumption, and
* cache-tag construction used by both normal ISR revalidation and PPR fallback
* shell regeneration.
*/
async function renderAppPageCacheArtifacts(options) {
	const rscCapture = teeAppPageRscStreamForCapture(options.renderToReadableStream(options.element, { onError: options.onError }), options.captureRscData);
	const capturedRscDataRef = { value: null };
	const fontPreloads = options.getFontPreloads();
	const htmlResult = await (await options.loadSsrHandler()).handleSsr(rscCapture.ssrStream, options.getNavigationContext(), {
		links: options.getFontLinks(),
		styles: options.getFontStyles(),
		preloads: fontPreloads
	}, {
		basePath: options.basePath,
		clientTraceMetadata: options.clientTraceMetadata,
		reactMaxHeadersLength: options.reactMaxHeadersLength,
		rootParams: options.rootParams,
		waitForAllReady: options.waitForAllReady,
		...rscCapture.sideStream ? {
			sideStream: rscCapture.sideStream,
			capturedRscDataRef
		} : {}
	});
	const htmlStream = isAppSsrRenderResult(htmlResult) ? htmlResult.htmlStream : htmlResult;
	const linkHeader = buildAppPageLinkHeader(isAppSsrRenderResult(htmlResult) ? htmlResult.linkHeader : void 0, buildAppPageFontLinkHeader(fontPreloads), options.reactMaxHeadersLength);
	const html = await readStreamAsText(htmlStream);
	let rscData;
	if (options.captureRscData) {
		const capturedPromise = capturedRscDataRef.value;
		if (!capturedPromise) throw new Error("[vinext] Expected captured RSC data while rendering app page cache artifacts");
		rscData = await capturedPromise;
	}
	const cacheLife = _consumeRequestScopedCacheLife();
	const tags = buildAppPageTags(options.cleanPathname, getCollectedFetchTags(), options.route.routeSegments);
	const observationState = consumeAppPageRenderObservationState();
	consumeInvalidDynamicUsageError();
	consumeDynamicUsage();
	const result = {
		html,
		htmlRenderObservation: createAppPageRenderObservation({
			boundaryOutcome: { kind: "success" },
			cacheability: "public",
			cacheTags: tags,
			cleanPathname: options.cleanPathname,
			completeness: "complete",
			output: createAppPageHtmlOutputScope({
				element: options.element,
				renderEpoch: null,
				rootBoundaryId: null,
				routePattern: options.route.pattern
			}),
			params: options.navigationParams,
			state: observationState
		}),
		...linkHeader ? { linkHeader } : {},
		tags,
		cacheControl: typeof cacheLife?.revalidate === "number" ? {
			revalidate: cacheLife.revalidate,
			expire: cacheLife.expire
		} : void 0
	};
	if (options.captureRscData) {
		result.rscData = rscData;
		result.rscRenderObservation = createAppPageRenderObservation({
			boundaryOutcome: { kind: "success" },
			cacheability: "public",
			cacheTags: tags,
			cleanPathname: options.cleanPathname,
			completeness: "complete",
			output: createAppPageRscOutputScope({
				element: options.element,
				mountedSlotsHeader: options.mountedSlotsHeader,
				renderEpoch: null,
				rootBoundaryId: null,
				routePattern: options.route.pattern
			}),
			params: options.navigationParams,
			state: observationState
		});
	}
	return result;
}
//#endregion
export { renderAppPageCacheArtifacts };
