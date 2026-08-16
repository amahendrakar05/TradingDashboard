import { AppRscRenderMode } from "./app-rsc-render-mode.js";
import { VINEXT_RSC_RENDER_MODE_HEADER } from "./headers.js";

//#region src/server/app-rsc-cache-busting.d.ts
/**
 * RSC cache-busting hashes cover the headers that make an RSC payload vary.
 * Client-side variant headers must survive transit through CDNs and reverse
 * proxies; stripping them changes the server hash and turns stale URLs into
 * repeated canonicalization redirects.
 */
declare const VINEXT_RSC_CACHE_BUSTING_SEARCH_PARAM = "_rsc";
declare const VINEXT_RSC_COMPATIBILITY_ID_HEADER = "X-Vinext-RSC-Compatibility-Id";
declare const VINEXT_RSC_CONTENT_TYPE = "text/x-component";
declare const VINEXT_RSC_VARY_HEADER: string;
type CreateRscRequestHeadersOptions = {
  clientReuseManifestHeader?: string | null;
  interceptionContext?: string | null;
  mountedSlotsHeader?: string | null;
  renderMode?: AppRscRenderMode;
};
type ResolveInvalidRscCacheBustingRequestOptions = {
  isRscRequest: boolean;
  request: Request;
};
declare function getVinextRscCompatibilityId(): string | null;
declare function applyRscCompatibilityIdHeader(headers: Headers, compatibilityId?: string | null | undefined): void;
declare function applyRscDeploymentIdHeader(headers: Headers): void;
declare function isRscCompatibilityIdCompatible(responseCompatibilityId: string | null | undefined, clientCompatibilityId?: string | null | undefined): boolean;
type RscCompatibilityNavigationDecision = {
  kind: "compatible";
} | {
  hardNavigationTarget: string;
  kind: "hard-navigate";
};
declare function resolveHardNavigationTargetFromRscResponse(responseUrl: string | null | undefined, currentHref: string, origin: string): string;
declare function resolveRscCompatibilityNavigationDecision(options: {
  clientCompatibilityId?: string | null;
  currentHref: string;
  origin: string;
  responseCompatibilityId: string | null | undefined;
  responseUrl?: string | null;
}): RscCompatibilityNavigationDecision;
/**
 * Detect the internal RSC cache-busting search param using the same
 * encoding-aware matching as `stripRscCacheBustingSearchParam`
 * (`isRscCacheBustingSearchPair`). The two share a single matcher so a guard
 * built on this helper and the stripper can never disagree on which pairs
 * count as `_rsc`, including encoded-key edge cases like `%5Frsc`.
 */
declare function hasRscCacheBustingSearchParam(url: URL): boolean;
declare function computeRscCacheBustingSearchParam(headers: Headers): Promise<string>;
declare function setRscCacheBustingSearchParam(url: URL, hash: string): void;
declare function stripRscCacheBustingSearchParam(url: URL): void;
/**
 * Remove a trailing `.rsc` suffix from a pathname. Returns the pathname
 * unchanged when the suffix is absent.
 */
declare function stripRscSuffix(pathname: string): string;
declare function createRscRequestHeaders(options?: CreateRscRequestHeadersOptions): Headers;
declare function createRscRequestUrl(href: string, headers: Headers): Promise<string>;
declare function createServerActionRequestUrl(href: string): string;
declare function createRscRedirectLocation(location: string, request: Request): Promise<string>;
declare function resolveInvalidRscCacheBustingRequest(options: ResolveInvalidRscCacheBustingRequestOptions): Promise<Response | null>;
//#endregion
export { VINEXT_RSC_CACHE_BUSTING_SEARCH_PARAM, VINEXT_RSC_COMPATIBILITY_ID_HEADER, VINEXT_RSC_CONTENT_TYPE, VINEXT_RSC_RENDER_MODE_HEADER, VINEXT_RSC_VARY_HEADER, applyRscCompatibilityIdHeader, applyRscDeploymentIdHeader, computeRscCacheBustingSearchParam, createRscRedirectLocation, createRscRequestHeaders, createRscRequestUrl, createServerActionRequestUrl, getVinextRscCompatibilityId, hasRscCacheBustingSearchParam, isRscCompatibilityIdCompatible, resolveHardNavigationTargetFromRscResponse, resolveInvalidRscCacheBustingRequest, resolveRscCompatibilityNavigationDecision, setRscCacheBustingSearchParam, stripRscCacheBustingSearchParam, stripRscSuffix };