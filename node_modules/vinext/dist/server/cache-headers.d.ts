//#region src/server/cache-headers.d.ts
type VinextCacheState = "HIT" | "MISS" | "STALE" | "STATIC";
declare function setCacheStateHeaders(headers: Headers, cacheState: VinextCacheState): void;
declare function buildCacheStateHeaders(cacheState: VinextCacheState): Record<string, string>;
//#endregion
export { buildCacheStateHeaders, setCacheStateHeaders };