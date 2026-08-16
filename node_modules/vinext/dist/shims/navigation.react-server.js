import { GLOBAL_ACCESSORS_KEY, ServerInsertedHTMLContext, _registerStateAccessors, clearServerInsertedHTML, flushServerInsertedHTML, getLayoutSegmentContext, getNavigationContext, renderServerInsertedHTML, setNavigationContext } from "./navigation-context-state.js";
import { BailoutToCSRError, DynamicServerError, HTTP_ERROR_FALLBACK_ERROR_CODE, RedirectType, forbidden, getAccessFallbackHTTPStatus, isBailoutToCSRError, isDynamicServerError, isHTTPAccessFallbackError, isNextRouterError, isRedirectError, notFound, permanentRedirect, redirect, unauthorized, unstable_rethrow } from "./navigation-errors.js";
import "./navigation-server.js";
import { ReadonlyURLSearchParams } from "./readonly-url-search-params.js";
import { throwClientHookError } from "./client-hook-error.js";
//#region src/shims/navigation.react-server.ts
function usePathname() {
	throwClientHookError("usePathname()");
}
function useSearchParams() {
	throwClientHookError("useSearchParams()");
}
function useParams() {
	throwClientHookError("useParams()");
}
function useRouter() {
	throwClientHookError("useRouter()");
}
function useSelectedLayoutSegment() {
	throwClientHookError("useSelectedLayoutSegment()");
}
function useSelectedLayoutSegments() {
	throwClientHookError("useSelectedLayoutSegments()");
}
function useServerInsertedHTML() {
	throwClientHookError("useServerInsertedHTML()");
}
function unstable_isUnrecognizedActionError() {
	throw new Error("`unstable_isUnrecognizedActionError` can only be used on the client.");
}
//#endregion
export { BailoutToCSRError, DynamicServerError, GLOBAL_ACCESSORS_KEY, HTTP_ERROR_FALLBACK_ERROR_CODE, ReadonlyURLSearchParams, RedirectType, ServerInsertedHTMLContext, _registerStateAccessors, clearServerInsertedHTML, flushServerInsertedHTML, forbidden, getAccessFallbackHTTPStatus, getLayoutSegmentContext, getNavigationContext, isBailoutToCSRError, isDynamicServerError, isHTTPAccessFallbackError, isNextRouterError, isRedirectError, notFound, permanentRedirect, redirect, renderServerInsertedHTML, setNavigationContext, unauthorized, unstable_isUnrecognizedActionError, unstable_rethrow, useParams, usePathname, useRouter, useSearchParams, useSelectedLayoutSegment, useSelectedLayoutSegments, useServerInsertedHTML };
