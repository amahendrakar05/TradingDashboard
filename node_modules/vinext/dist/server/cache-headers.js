import { NEXTJS_CACHE_HEADER, VINEXT_CACHE_HEADER } from "./headers.js";
//#region src/server/cache-headers.ts
function toNextJsCacheState(cacheState) {
	return cacheState === "STATIC" ? "HIT" : cacheState;
}
function setCacheStateHeaders(headers, cacheState) {
	headers.set(VINEXT_CACHE_HEADER, cacheState);
	headers.set(NEXTJS_CACHE_HEADER, toNextJsCacheState(cacheState));
}
function buildCacheStateHeaders(cacheState) {
	return {
		[VINEXT_CACHE_HEADER]: cacheState,
		[NEXTJS_CACHE_HEADER]: toNextJsCacheState(cacheState)
	};
}
//#endregion
export { buildCacheStateHeaders, setCacheStateHeaders };
