import { encodeCacheTag } from "../utils/encode-cache-tag.js";
//#region src/server/implicit-tags.ts
const NEXT_CACHE_IMPLICIT_TAG_ID = "_N_T_";
function appendUnique(tags, tag) {
	if (!tags.includes(tag)) tags.push(tag);
}
function normalizeRouteSegment(segment) {
	if (!segment || segment === "." || segment.startsWith("@")) return null;
	return segment;
}
function buildRouteCachePath(routeSegments, leafKind) {
	const parts = [];
	for (const segment of routeSegments) {
		const normalized = normalizeRouteSegment(segment);
		if (normalized) parts.push(normalized);
	}
	parts.push(leafKind);
	return `/${parts.join("/")}`;
}
function appendDerivedTags(tags, routePath) {
	appendUnique(tags, `${NEXT_CACHE_IMPLICIT_TAG_ID}/layout`);
	if (!routePath.startsWith("/")) return;
	const routeParts = routePath.split("/");
	const leafIndex = routeParts.length - 1;
	for (let i = 1; i <= routeParts.length; i++) {
		let currentPathname = routeParts.slice(0, i).join("/");
		if (!currentPathname) continue;
		if (!(i - 1 === leafIndex)) currentPathname = `${currentPathname}/layout`;
		appendUnique(tags, `${NEXT_CACHE_IMPLICIT_TAG_ID}${currentPathname}`);
	}
}
function buildAppPageTags(cleanPathname, extraTags, routeSegments) {
	return buildPageCacheTags(cleanPathname, extraTags, [...routeSegments], "page");
}
function buildPageCacheTags(pathname, extraTags, routeSegments, leafKind) {
	const normalizedPathname = pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
	const tags = [pathname, `${NEXT_CACHE_IMPLICIT_TAG_ID}${normalizedPathname}`];
	if (pathname === "/") appendUnique(tags, `${NEXT_CACHE_IMPLICIT_TAG_ID}/index`);
	if (pathname === "/index") appendUnique(tags, `${NEXT_CACHE_IMPLICIT_TAG_ID}/`);
	appendDerivedTags(tags, buildRouteCachePath(routeSegments, leafKind));
	for (const tag of extraTags) appendUnique(tags, tag);
	return tags.map(encodeCacheTag);
}
//#endregion
export { buildAppPageTags, buildPageCacheTags };
