import { AppElements } from "./app-elements-wire.js";
import { CachedRscResponse } from "../shims/navigation.js";

//#region src/server/app-visited-response-cache.d.ts
type VisitedResponseCacheNavigationKind = "navigate" | "refresh" | "traverse";
type VisitedResponseCacheEntry = {
  createdAt: number;
  elements?: AppElements;
  expiresAt: number;
  mountedSlotsHeader: string | null;
  params: Record<string, string | string[]>;
  response: CachedRscResponse;
};
declare const VISITED_RESPONSE_CACHE_TTL: number;
declare const MAX_TRAVERSAL_CACHE_TTL: number;
declare function createVisitedResponseCacheEntry(options: {
  elements?: AppElements;
  fallbackTtlMs?: number;
  now: number;
  mountedSlotsHeader?: string | null;
  params: Record<string, string | string[]>;
  response: CachedRscResponse;
}): VisitedResponseCacheEntry;
declare function isVisitedResponseCacheEntryFresh(entry: VisitedResponseCacheEntry, options: {
  navigationKind: VisitedResponseCacheNavigationKind;
  now: number;
}): boolean;
//#endregion
export { MAX_TRAVERSAL_CACHE_TTL, VISITED_RESPONSE_CACHE_TTL, VisitedResponseCacheEntry, createVisitedResponseCacheEntry, isVisitedResponseCacheEntryFresh };