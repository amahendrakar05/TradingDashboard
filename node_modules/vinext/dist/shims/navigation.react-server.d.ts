import { ReadonlyURLSearchParams } from "./readonly-url-search-params.js";
import { GLOBAL_ACCESSORS_KEY, NavigationContext, SegmentMap, ServerInsertedHTMLContext, _registerStateAccessors, clearServerInsertedHTML, flushServerInsertedHTML, getLayoutSegmentContext, getNavigationContext, renderServerInsertedHTML, setNavigationContext } from "./navigation-context-state.js";
import { BailoutToCSRError, DynamicServerError, HTTP_ERROR_FALLBACK_ERROR_CODE, RedirectType, forbidden, getAccessFallbackHTTPStatus, isBailoutToCSRError, isDynamicServerError, isHTTPAccessFallbackError, isNextRouterError, isRedirectError, notFound, permanentRedirect, redirect, unauthorized, unstable_rethrow } from "./navigation-errors.js";
//#region src/shims/navigation.react-server.d.ts
declare function usePathname(): never;
declare function useSearchParams(): never;
declare function useParams(): never;
declare function useRouter(): never;
declare function useSelectedLayoutSegment(): never;
declare function useSelectedLayoutSegments(): never;
declare function useServerInsertedHTML(): never;
declare function unstable_isUnrecognizedActionError(): boolean;
//#endregion
export { BailoutToCSRError, DynamicServerError, GLOBAL_ACCESSORS_KEY, HTTP_ERROR_FALLBACK_ERROR_CODE, type NavigationContext, ReadonlyURLSearchParams, RedirectType, type SegmentMap, ServerInsertedHTMLContext, _registerStateAccessors, clearServerInsertedHTML, flushServerInsertedHTML, forbidden, getAccessFallbackHTTPStatus, getLayoutSegmentContext, getNavigationContext, isBailoutToCSRError, isDynamicServerError, isHTTPAccessFallbackError, isNextRouterError, isRedirectError, notFound, permanentRedirect, redirect, renderServerInsertedHTML, setNavigationContext, unauthorized, unstable_isUnrecognizedActionError, unstable_rethrow, useParams, usePathname, useRouter, useSearchParams, useSelectedLayoutSegment, useSelectedLayoutSegments, useServerInsertedHTML };