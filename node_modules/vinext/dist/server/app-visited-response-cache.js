import { resolveCachedRscResponseExpiresAt } from "../shims/navigation.js";
//#region src/server/app-visited-response-cache.ts
const VISITED_RESPONSE_CACHE_TTL = 5 * 6e4;
const MAX_TRAVERSAL_CACHE_TTL = 30 * 6e4;
function createVisitedResponseCacheEntry(options) {
	return {
		createdAt: options.now,
		...options.elements ? { elements: options.elements } : {},
		expiresAt: resolveCachedRscResponseExpiresAt(options.now, options.response, options.fallbackTtlMs ?? 3e5),
		mountedSlotsHeader: options.mountedSlotsHeader ?? null,
		params: options.params,
		response: options.response
	};
}
function isVisitedResponseCacheEntryFresh(entry, options) {
	if (options.navigationKind === "refresh") return false;
	if (options.navigationKind === "traverse") return options.now - entry.createdAt < MAX_TRAVERSAL_CACHE_TTL;
	return entry.expiresAt > options.now;
}
//#endregion
export { MAX_TRAVERSAL_CACHE_TTL, VISITED_RESPONSE_CACHE_TTL, createVisitedResponseCacheEntry, isVisitedResponseCacheEntryFresh };
