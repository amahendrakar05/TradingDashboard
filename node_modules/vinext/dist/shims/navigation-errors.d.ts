//#region src/shims/navigation-errors.d.ts
/**
 * Server-safe navigation control-flow errors and predicates.
 *
 * This module intentionally has no React or browser-runtime dependencies so
 * RSC, SSR, and the public next/navigation shim can share one implementation.
 */
declare const HTTP_ERROR_FALLBACK_ERROR_CODE = "NEXT_HTTP_ERROR_FALLBACK";
declare function isHTTPAccessFallbackError(error: unknown): boolean;
declare function getAccessFallbackHTTPStatus(error: unknown): number;
declare enum RedirectType {
  push = "push",
  replace = "replace"
}
/**
 * The omitted redirect type is resolved by the catch site: push for Server
 * Actions and replace for ordinary SSR/RSC rendering.
 */
declare function redirect(url: string, type?: "replace" | "push" | RedirectType): never;
declare function permanentRedirect(url: string, type?: "replace" | "push" | RedirectType): never;
declare function notFound(): never;
declare function forbidden(): never;
declare function unauthorized(): never;
type RedirectErrorShape = Error & {
  digest: string;
};
/**
 * vinext accepts its three-part redirect digest and Next.js's five-part form.
 * This is deliberately only a cheap prefix gate because vinext permits an
 * empty redirect type; parseRedirectDigest is the authoritative validator.
 */
declare function isRedirectError(error: unknown): error is RedirectErrorShape;
declare function decodeRedirectError(digest: string): {
  url: string;
  type: "push" | "replace";
} | null;
declare function isNextRouterError(error: unknown): boolean;
declare class BailoutToCSRError extends Error {
  readonly digest = "BAILOUT_TO_CLIENT_SIDE_RENDERING";
  readonly reason: string;
  constructor(reason: string);
}
declare function isBailoutToCSRError(error: unknown): error is BailoutToCSRError;
declare class DynamicServerError extends Error {
  readonly digest = "DYNAMIC_SERVER_USAGE";
  readonly description: string;
  constructor(description: string);
}
declare function isDynamicServerError(error: unknown): error is DynamicServerError;
/**
 * Rethrow framework control-flow signals before user error handling consumes
 * them. This covers the categories vinext can currently produce.
 */
declare function unstable_rethrow(error: unknown): void;
//#endregion
export { BailoutToCSRError, DynamicServerError, HTTP_ERROR_FALLBACK_ERROR_CODE, RedirectType, decodeRedirectError, forbidden, getAccessFallbackHTTPStatus, isBailoutToCSRError, isDynamicServerError, isHTTPAccessFallbackError, isNextRouterError, isRedirectError, notFound, permanentRedirect, redirect, unauthorized, unstable_rethrow };