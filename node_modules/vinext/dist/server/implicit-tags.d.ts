//#region src/server/implicit-tags.d.ts
type AppCacheLeafKind = "page" | "route";
declare function buildAppPageTags(cleanPathname: string, extraTags: string[], routeSegments: readonly string[]): string[];
declare function buildPageCacheTags(pathname: string, extraTags: string[], routeSegments: string[], leafKind: AppCacheLeafKind): string[];
//#endregion
export { buildAppPageTags, buildPageCacheTags };