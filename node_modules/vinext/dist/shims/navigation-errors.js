import { parseRedirectDigest } from "../utils/redirect-digest.js";
//#region src/shims/navigation-errors.ts
/**
* Server-safe navigation control-flow errors and predicates.
*
* This module intentionally has no React or browser-runtime dependencies so
* RSC, SSR, and the public next/navigation shim can share one implementation.
*/
const HTTP_ERROR_FALLBACK_ERROR_CODE = "NEXT_HTTP_ERROR_FALLBACK";
function isHTTPAccessFallbackError(error) {
	if (!error || typeof error !== "object" || !("digest" in error)) return false;
	const digest = String(error.digest);
	return digest === "NEXT_NOT_FOUND" || digest.startsWith(`NEXT_HTTP_ERROR_FALLBACK;`);
}
function getAccessFallbackHTTPStatus(error) {
	if (error && typeof error === "object" && "digest" in error) {
		const digest = String(error.digest);
		if (digest === "NEXT_NOT_FOUND") return 404;
		if (digest.startsWith(`NEXT_HTTP_ERROR_FALLBACK;`)) return Number.parseInt(digest.split(";")[1], 10);
	}
	return 404;
}
let RedirectType = /* @__PURE__ */ function(RedirectType) {
	RedirectType["push"] = "push";
	RedirectType["replace"] = "replace";
	return RedirectType;
}({});
var VinextNavigationError = class extends Error {
	digest;
	constructor(message, digest) {
		super(message);
		this.digest = digest;
	}
};
/**
* The omitted redirect type is resolved by the catch site: push for Server
* Actions and replace for ordinary SSR/RSC rendering.
*/
function redirect(url, type) {
	throw new VinextNavigationError(`NEXT_REDIRECT:${url}`, `NEXT_REDIRECT;${type ?? ""};${encodeURIComponent(url)}`);
}
function permanentRedirect(url, type = "replace") {
	throw new VinextNavigationError(`NEXT_REDIRECT:${url}`, `NEXT_REDIRECT;${type};${encodeURIComponent(url)};308`);
}
function notFound() {
	throw new VinextNavigationError("NEXT_NOT_FOUND", `${HTTP_ERROR_FALLBACK_ERROR_CODE};404`);
}
function forbidden() {
	throw new VinextNavigationError("NEXT_FORBIDDEN", `${HTTP_ERROR_FALLBACK_ERROR_CODE};403`);
}
function unauthorized() {
	throw new VinextNavigationError("NEXT_UNAUTHORIZED", `${HTTP_ERROR_FALLBACK_ERROR_CODE};401`);
}
/**
* vinext accepts its three-part redirect digest and Next.js's five-part form.
* This is deliberately only a cheap prefix gate because vinext permits an
* empty redirect type; parseRedirectDigest is the authoritative validator.
*/
function isRedirectError(error) {
	return !!error && typeof error === "object" && "digest" in error && typeof error.digest === "string" && error.digest.startsWith("NEXT_REDIRECT;");
}
function decodeRedirectError(digest) {
	const redirect = parseRedirectDigest(digest);
	if (!redirect) return null;
	return {
		url: redirect.url,
		type: redirect.type === "push" ? "push" : "replace"
	};
}
function isNextRouterError(error) {
	return isRedirectError(error) || isHTTPAccessFallbackError(error);
}
const BAILOUT_TO_CSR_DIGEST = "BAILOUT_TO_CLIENT_SIDE_RENDERING";
var BailoutToCSRError = class extends Error {
	digest = BAILOUT_TO_CSR_DIGEST;
	reason;
	constructor(reason) {
		super(`Bail out to client-side rendering: ${reason}`);
		this.reason = reason;
	}
};
function isBailoutToCSRError(error) {
	return !!error && typeof error === "object" && "digest" in error && error.digest === BAILOUT_TO_CSR_DIGEST;
}
const DYNAMIC_SERVER_USAGE_DIGEST = "DYNAMIC_SERVER_USAGE";
var DynamicServerError = class extends Error {
	digest = DYNAMIC_SERVER_USAGE_DIGEST;
	description;
	constructor(description) {
		super(`Dynamic server usage: ${description}`);
		this.description = description;
	}
};
function isDynamicServerError(error) {
	return !!error && typeof error === "object" && "digest" in error && error.digest === DYNAMIC_SERVER_USAGE_DIGEST;
}
/**
* Rethrow framework control-flow signals before user error handling consumes
* them. This covers the categories vinext can currently produce.
*/
function unstable_rethrow(error) {
	if (isNextRouterError(error) || isBailoutToCSRError(error) || isDynamicServerError(error)) throw error;
	if (error instanceof Error && "cause" in error) unstable_rethrow(error.cause);
}
//#endregion
export { BailoutToCSRError, DynamicServerError, HTTP_ERROR_FALLBACK_ERROR_CODE, RedirectType, decodeRedirectError, forbidden, getAccessFallbackHTTPStatus, isBailoutToCSRError, isDynamicServerError, isHTTPAccessFallbackError, isNextRouterError, isRedirectError, notFound, permanentRedirect, redirect, unauthorized, unstable_rethrow };
