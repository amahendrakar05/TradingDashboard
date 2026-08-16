import { NEXTJS_CACHE_HEADER, VINEXT_CACHE_HEADER } from "./headers.js";
import { setCacheStateHeaders } from "./cache-headers.js";
import { applyCdnResponseHeaders } from "./cache-control.js";
import { buildAppPageCacheValue } from "./isr-cache.js";
import { readStreamAsText } from "../utils/text-stream.js";
import { createEmptyAppPageRenderObservationState } from "./app-page-render-observation.js";
//#region src/server/app-page-cache-finalizer.ts
function applyPendingDynamicCdnHeaders(headers, tags, options = {}) {
	applyCdnResponseHeaders(headers, {
		cacheControl: headers.get("Cache-Control") ?? "",
		pendingDynamicCheck: true,
		tags
	});
	if (options.omitCacheState === true) {
		headers.delete(VINEXT_CACHE_HEADER);
		headers.delete(NEXTJS_CACHE_HEADER);
		return;
	}
	setCacheStateHeaders(headers, "MISS");
}
function resolveAppPageCacheWritePolicy(options) {
	let revalidateSeconds = options.revalidateSeconds;
	let expireSeconds = options.expireSeconds;
	const requestCacheLife = options.requestCacheLife;
	if (requestCacheLife?.revalidate !== void 0) revalidateSeconds = revalidateSeconds === null ? requestCacheLife.revalidate : Math.min(revalidateSeconds, requestCacheLife.revalidate);
	if (requestCacheLife?.expire !== void 0) expireSeconds = requestCacheLife.expire;
	if (revalidateSeconds === null || Number.isNaN(revalidateSeconds) || revalidateSeconds <= 0) return null;
	return {
		expireSeconds,
		revalidateSeconds
	};
}
function finalizeAppPageHtmlCacheResponse(response, options) {
	if (!response.body) return response;
	const [streamForClient, streamForCache] = response.body.tee();
	const htmlKey = options.isrHtmlKey(options.cleanPathname);
	const rscKey = options.isrRscKey(options.cleanPathname, null, void 0, options.interceptionContext);
	const clientHeaders = new Headers(response.headers);
	if (options.preserveClientResponseHeaders !== true) applyPendingDynamicCdnHeaders(clientHeaders, options.getPageTags(), { omitCacheState: options.omitPendingDynamicCacheState === true });
	const cachePromise = (async () => {
		try {
			const cachedHtml = await readStreamAsText(streamForCache);
			if (options.capturedDynamicUsageBeforeContextCleanup?.() === true || options.consumeDynamicUsage()) {
				options.isrDebug?.("HTML cache write skipped (dynamic usage during render)", htmlKey);
				return;
			}
			const cachePolicy = resolveAppPageCacheWritePolicy({
				expireSeconds: options.expireSeconds,
				requestCacheLife: options.getRequestCacheLife?.(),
				revalidateSeconds: options.revalidateSeconds
			});
			if (!cachePolicy) {
				options.isrDebug?.("HTML cache write skipped (no cache policy)", htmlKey);
				return;
			}
			const pageTags = options.getPageTags();
			const observationState = options.consumeRenderObservationState?.() ?? createEmptyAppPageRenderObservationState();
			const htmlRenderObservation = options.createHtmlRenderObservation?.({
				cacheTags: pageTags,
				state: observationState
			});
			const rscRenderObservation = options.createRscRenderObservation?.({
				cacheTags: pageTags,
				state: observationState
			});
			const linkHeader = response.headers.get("link");
			const writes = [options.isrSet(htmlKey, buildAppPageCacheValue(cachedHtml, void 0, 200, htmlRenderObservation, linkHeader ? { link: linkHeader } : void 0), cachePolicy.revalidateSeconds, pageTags, cachePolicy.expireSeconds)];
			if (options.capturedRscDataPromise) writes.push(options.capturedRscDataPromise.then((rscData) => options.isrSet(rscKey, buildAppPageCacheValue("", rscData, 200, rscRenderObservation), cachePolicy.revalidateSeconds, pageTags, cachePolicy.expireSeconds)));
			await Promise.all(writes);
			options.isrDebug?.("HTML cache written", htmlKey);
		} catch (cacheError) {
			console.error("[vinext] ISR cache write error:", cacheError);
		}
	})();
	options.waitUntil?.(cachePromise);
	return new Response(streamForClient, {
		status: response.status,
		statusText: response.statusText,
		headers: clientHeaders
	});
}
function finalizeAppPageRscCacheResponse(response, options) {
	if (!scheduleAppPageRscCacheWrite(options)) return response;
	if (options.preserveClientResponseHeaders === true) return response;
	const clientHeaders = new Headers(response.headers);
	applyPendingDynamicCdnHeaders(clientHeaders, options.getPageTags(), { omitCacheState: options.omitPendingDynamicCacheState === true });
	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers: clientHeaders
	});
}
function scheduleAppPageRscCacheWrite(options) {
	const capturedRscDataPromise = options.capturedRscDataPromise;
	if (!capturedRscDataPromise || options.dynamicUsedDuringBuild || options.mountedSlotsHeader) return false;
	const rscKey = options.isrRscKey(options.cleanPathname, null, options.renderMode, options.interceptionContext);
	const cachePromise = (async () => {
		try {
			const rscData = await capturedRscDataPromise;
			if (options.consumeDynamicUsage()) {
				options.isrDebug?.("RSC cache write skipped (dynamic usage during render)", rscKey);
				return;
			}
			const cachePolicy = resolveAppPageCacheWritePolicy({
				expireSeconds: options.expireSeconds,
				requestCacheLife: options.getRequestCacheLife?.(),
				revalidateSeconds: options.revalidateSeconds
			});
			if (!cachePolicy) {
				options.isrDebug?.("RSC cache write skipped (no cache policy)", rscKey);
				return;
			}
			const pageTags = options.getPageTags();
			const observationState = options.consumeRenderObservationState?.() ?? createEmptyAppPageRenderObservationState();
			const rscRenderObservation = options.createRscRenderObservation?.({
				cacheTags: pageTags,
				state: observationState
			});
			await options.isrSet(rscKey, buildAppPageCacheValue("", rscData, 200, rscRenderObservation), cachePolicy.revalidateSeconds, pageTags, cachePolicy.expireSeconds);
			options.isrDebug?.("RSC cache written", rscKey);
		} catch (cacheError) {
			console.error("[vinext] ISR RSC cache write error:", cacheError);
		}
	})();
	options.waitUntil?.(cachePromise);
	return true;
}
//#endregion
export { finalizeAppPageHtmlCacheResponse, finalizeAppPageRscCacheResponse, scheduleAppPageRscCacheWrite };
