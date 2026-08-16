import { NEXTJS_DEPLOYMENT_ID_HEADER, NEXT_ROUTER_PREFETCH_HEADER, NEXT_ROUTER_SEGMENT_PREFETCH_HEADER, NEXT_ROUTER_STATE_TREE_HEADER, NEXT_URL_HEADER, VINEXT_CLIENT_REUSE_MANIFEST_HEADER, VINEXT_INTERCEPTION_CONTEXT_HEADER, VINEXT_MOUNTED_SLOTS_HEADER, VINEXT_RSC_RENDER_MODE_HEADER } from "./headers.js";
import { fnv1a64 } from "../utils/hash.js";
import { parseAppRscRenderMode } from "./app-rsc-render-mode.js";
import { applyDeploymentIdHeader, getDeploymentId } from "../utils/deployment-id.js";
//#region src/server/app-rsc-cache-busting.ts
/**
* RSC cache-busting hashes cover the headers that make an RSC payload vary.
* Client-side variant headers must survive transit through CDNs and reverse
* proxies; stripping them changes the server hash and turns stale URLs into
* repeated canonicalization redirects.
*/
const VINEXT_RSC_CACHE_BUSTING_SEARCH_PARAM = "_rsc";
const VINEXT_RSC_COMPATIBILITY_ID_HEADER = "X-Vinext-RSC-Compatibility-Id";
const VINEXT_RSC_CONTENT_TYPE = "text/x-component";
const VINEXT_RSC_VARY_HEADER = [
	"RSC",
	NEXT_ROUTER_STATE_TREE_HEADER,
	NEXT_ROUTER_PREFETCH_HEADER,
	NEXT_ROUTER_SEGMENT_PREFETCH_HEADER,
	NEXT_URL_HEADER,
	VINEXT_INTERCEPTION_CONTEXT_HEADER,
	VINEXT_MOUNTED_SLOTS_HEADER,
	VINEXT_RSC_RENDER_MODE_HEADER
].join(", ");
const CACHE_BUSTING_DIGEST_BYTES = 12;
const textEncoder = new TextEncoder();
function encodeBase64Url(bytes) {
	let binary = "";
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}
function normalizeHeaderValue(value) {
	return value ?? "0";
}
function normalizeCompatibilityId(value) {
	return value && value.length > 0 ? value : null;
}
function getVinextRscCompatibilityId() {
	return normalizeCompatibilityId(process.env.__VINEXT_RSC_COMPATIBILITY_ID);
}
function applyRscCompatibilityIdHeader(headers, compatibilityId = getVinextRscCompatibilityId()) {
	const normalized = normalizeCompatibilityId(compatibilityId);
	if (normalized) headers.set(VINEXT_RSC_COMPATIBILITY_ID_HEADER, normalized);
	else headers.delete(VINEXT_RSC_COMPATIBILITY_ID_HEADER);
}
function applyRscDeploymentIdHeader(headers) {
	const deploymentId = getDeploymentId();
	if (deploymentId) headers.set(NEXTJS_DEPLOYMENT_ID_HEADER, deploymentId);
	else headers.delete(NEXTJS_DEPLOYMENT_ID_HEADER);
}
function isRscCompatibilityIdCompatible(responseCompatibilityId, clientCompatibilityId = getVinextRscCompatibilityId()) {
	const normalizedResponseCompatibilityId = normalizeCompatibilityId(responseCompatibilityId);
	const normalizedClientCompatibilityId = normalizeCompatibilityId(clientCompatibilityId);
	return normalizedClientCompatibilityId === null || normalizedResponseCompatibilityId !== null && normalizedResponseCompatibilityId === normalizedClientCompatibilityId;
}
function resolveHardNavigationTargetFromRscResponse(responseUrl, currentHref, origin) {
	if (!responseUrl) return currentHref;
	const parsed = new URL(responseUrl, origin);
	stripRscCacheBustingSearchParam(parsed);
	const origUrl = new URL(currentHref, origin);
	let pathname = stripRscSuffix(parsed.pathname);
	if (origUrl.pathname.length > 1 && origUrl.pathname.endsWith("/") && !pathname.endsWith("/")) pathname += "/";
	let hardNavigationTarget = pathname + parsed.search;
	if (origUrl.hash) hardNavigationTarget += origUrl.hash;
	return hardNavigationTarget;
}
function resolveRscCompatibilityNavigationDecision(options) {
	if (isRscCompatibilityIdCompatible(options.responseCompatibilityId, options.clientCompatibilityId)) return { kind: "compatible" };
	return {
		hardNavigationTarget: resolveHardNavigationTargetFromRscResponse(options.responseUrl, options.currentHref, options.origin),
		kind: "hard-navigate"
	};
}
function normalizeRenderModeHeaderValue(value) {
	const renderMode = parseAppRscRenderMode(value);
	return renderMode === "navigation" ? null : renderMode;
}
function createCacheBustingInput(headers, options = {}) {
	const values = [
		headers.get(NEXT_ROUTER_PREFETCH_HEADER),
		headers.get(NEXT_ROUTER_SEGMENT_PREFETCH_HEADER),
		headers.get(NEXT_ROUTER_STATE_TREE_HEADER),
		headers.get(NEXT_URL_HEADER),
		headers.get(VINEXT_INTERCEPTION_CONTEXT_HEADER),
		headers.get(VINEXT_MOUNTED_SLOTS_HEADER),
		...options.includeRenderModeHeader === false ? [] : [normalizeRenderModeHeaderValue(headers.get(VINEXT_RSC_RENDER_MODE_HEADER))]
	];
	if (values.every((value) => value === null)) return null;
	return values.map(normalizeHeaderValue).join(",");
}
async function sha256CacheBustingHash(input) {
	const digest = await globalThis.crypto.subtle.digest("SHA-256", textEncoder.encode(input));
	return encodeBase64Url(new Uint8Array(digest).subarray(0, CACHE_BUSTING_DIGEST_BYTES));
}
function computeLegacyRscCacheBustingSearchParam(headers) {
	const input = createCacheBustingInput(headers);
	return input === null ? "" : fnv1a64(input);
}
async function computePreviousRscCacheBustingSearchParam(headers) {
	const input = createCacheBustingInput(headers, { includeRenderModeHeader: false });
	if (input === null) return null;
	return sha256CacheBustingHash(input);
}
function computePreviousLegacyRscCacheBustingSearchParam(headers) {
	const input = createCacheBustingInput(headers, { includeRenderModeHeader: false });
	return input === null ? null : fnv1a64(input);
}
function getSearchPairsWithoutRscCacheBusting(url) {
	return (url.search.startsWith("?") ? url.search.slice(1) : url.search).split("&").filter((pair) => pair.length > 0 && !isRscCacheBustingSearchPair(pair));
}
function isRscCacheBustingSearchPair(pair) {
	const separatorIndex = pair.indexOf("=");
	const rawKey = separatorIndex === -1 ? pair : pair.slice(0, separatorIndex);
	try {
		return decodeURIComponent(rawKey.replaceAll("+", " ")) === VINEXT_RSC_CACHE_BUSTING_SEARCH_PARAM;
	} catch {
		return rawKey === VINEXT_RSC_CACHE_BUSTING_SEARCH_PARAM;
	}
}
/**
* Detect the internal RSC cache-busting search param using the same
* encoding-aware matching as `stripRscCacheBustingSearchParam`
* (`isRscCacheBustingSearchPair`). The two share a single matcher so a guard
* built on this helper and the stripper can never disagree on which pairs
* count as `_rsc`, including encoded-key edge cases like `%5Frsc`.
*/
function hasRscCacheBustingSearchParam(url) {
	return (url.search.startsWith("?") ? url.search.slice(1) : url.search).split("&").some((pair) => pair.length > 0 && isRscCacheBustingSearchPair(pair));
}
async function computeRscCacheBustingSearchParam(headers) {
	const input = createCacheBustingInput(headers);
	if (input === null) return "";
	return sha256CacheBustingHash(input);
}
function setRscCacheBustingSearchParam(url, hash) {
	const pairs = getSearchPairsWithoutRscCacheBusting(url);
	pairs.push(hash.length > 0 ? `${VINEXT_RSC_CACHE_BUSTING_SEARCH_PARAM}=${hash}` : VINEXT_RSC_CACHE_BUSTING_SEARCH_PARAM);
	url.search = `?${pairs.join("&")}`;
}
function stripRscCacheBustingSearchParam(url) {
	const pairs = getSearchPairsWithoutRscCacheBusting(url);
	url.search = pairs.length > 0 ? `?${pairs.join("&")}` : "";
}
/**
* Remove a trailing `.rsc` suffix from a pathname. Returns the pathname
* unchanged when the suffix is absent.
*/
function stripRscSuffix(pathname) {
	return pathname.endsWith(".rsc") ? pathname.slice(0, -4) : pathname;
}
function createRscRequestHeaders(options = {}) {
	const headers = new Headers({
		Accept: VINEXT_RSC_CONTENT_TYPE,
		["RSC"]: "1"
	});
	applyDeploymentIdHeader(headers);
	if (options.interceptionContext !== void 0 && options.interceptionContext !== null) headers.set(VINEXT_INTERCEPTION_CONTEXT_HEADER, options.interceptionContext);
	if (options.mountedSlotsHeader !== void 0 && options.mountedSlotsHeader !== null) headers.set(VINEXT_MOUNTED_SLOTS_HEADER, options.mountedSlotsHeader);
	if (options.clientReuseManifestHeader !== void 0 && options.clientReuseManifestHeader !== null) headers.set(VINEXT_CLIENT_REUSE_MANIFEST_HEADER, options.clientReuseManifestHeader);
	const renderMode = options.renderMode ?? "navigation";
	if (renderMode !== "navigation") headers.set(VINEXT_RSC_RENDER_MODE_HEADER, renderMode);
	return headers;
}
function toRscRequestPath(href) {
	const hashIndex = href.indexOf("#");
	return hashIndex === -1 ? href : href.slice(0, hashIndex);
}
async function createRscRequestUrl(href, headers) {
	const url = new URL(toRscRequestPath(href), "http://vinext.local");
	setRscCacheBustingSearchParam(url, await computeRscCacheBustingSearchParam(headers));
	return `${url.pathname}${url.search}`;
}
function createServerActionRequestUrl(href) {
	const hashIndex = href.indexOf("#");
	const beforeHash = hashIndex === -1 ? href : href.slice(0, hashIndex);
	const url = new URL(beforeHash, "http://vinext.local");
	return `${url.pathname}${url.search}`;
}
async function createRscRedirectLocation(location, request) {
	const requestUrl = new URL(request.url);
	const destinationUrl = new URL(location, requestUrl);
	if (destinationUrl.origin !== requestUrl.origin) return destinationUrl.toString();
	const rscPath = await createRscRequestUrl(`${destinationUrl.pathname}${destinationUrl.search}`, request.headers);
	return `${destinationUrl.origin}${rscPath}`;
}
async function resolveInvalidRscCacheBustingRequest(options) {
	if (!options.isRscRequest || options.request.method !== "GET" && options.request.method !== "HEAD") return null;
	const url = new URL(options.request.url);
	const actualHash = url.searchParams.get(VINEXT_RSC_CACHE_BUSTING_SEARCH_PARAM);
	const expectedHash = await computeRscCacheBustingSearchParam(options.request.headers);
	if (actualHash === null && expectedHash === "" && url.pathname.endsWith(".rsc")) return null;
	const acceptedHashes = /* @__PURE__ */ new Set([expectedHash]);
	if (actualHash !== null && actualHash !== expectedHash) {
		acceptedHashes.add(computeLegacyRscCacheBustingSearchParam(options.request.headers));
		if (normalizeRenderModeHeaderValue(options.request.headers.get("X-Vinext-Rsc-Render-Mode")) === null) {
			const previousHash = await computePreviousRscCacheBustingSearchParam(options.request.headers);
			const previousLegacyHash = computePreviousLegacyRscCacheBustingSearchParam(options.request.headers);
			if (previousHash !== null) acceptedHashes.add(previousHash);
			if (previousLegacyHash !== null) acceptedHashes.add(previousLegacyHash);
		}
	}
	if (actualHash !== null && acceptedHashes.has(actualHash)) return null;
	setRscCacheBustingSearchParam(url, expectedHash);
	return new Response(null, {
		status: 307,
		headers: { Location: `${url.pathname}${url.search}` }
	});
}
//#endregion
export { VINEXT_RSC_CACHE_BUSTING_SEARCH_PARAM, VINEXT_RSC_COMPATIBILITY_ID_HEADER, VINEXT_RSC_CONTENT_TYPE, VINEXT_RSC_RENDER_MODE_HEADER, VINEXT_RSC_VARY_HEADER, applyRscCompatibilityIdHeader, applyRscDeploymentIdHeader, computeRscCacheBustingSearchParam, createRscRedirectLocation, createRscRequestHeaders, createRscRequestUrl, createServerActionRequestUrl, getVinextRscCompatibilityId, hasRscCacheBustingSearchParam, isRscCompatibilityIdCompatible, resolveHardNavigationTargetFromRscResponse, resolveInvalidRscCacheBustingRequest, resolveRscCompatibilityNavigationDecision, setRscCacheBustingSearchParam, stripRscCacheBustingSearchParam, stripRscSuffix };
