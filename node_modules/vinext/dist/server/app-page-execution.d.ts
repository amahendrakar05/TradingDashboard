import { ClassificationReason } from "../build/layout-classification-types.js";
import { LayoutFlags } from "./app-elements-wire.js";
//#region src/server/app-page-execution.d.ts
declare function tagAppPageMetadataError<T>(error: T): T;
type AppPageSpecialError = {
  kind: "redirect";
  location: string;
  statusCode: number;
  type?: "push" | "replace";
  fromMetadata?: boolean;
} | {
  kind: "http-access-fallback";
  statusCode: number;
  fromMetadata?: boolean;
};
type AppPageFontPreload = {
  href: string;
  type: string;
};
type AppPageRscStreamCapture = {
  /** Stream for createFromReadableStream (SSR). Always set. */ssrStream: ReadableStream<Uint8Array>; /** When capturing, the combined embed+capture stream. handleSsr consumes this. */
  sideStream?: ReadableStream<Uint8Array>;
};
/**
 * Builds an RSC flight payload that encodes a `redirect()` as a React error
 * with the canonical `NEXT_REDIRECT;<type>;<url>;<status>;` digest. Mirrors
 * Next.js's behavior in `app-render.tsx generateDynamicFlightRenderResult`
 * where a redirect thrown during RSC rendering propagates through
 * `renderToFlightStream`'s `onError` handler and is serialized into the
 * stream — the HTTP response stays 200 because the redirect rides in the
 * flight body, not the status line.
 *
 * Returns a stream that the caller wraps in a 200 response with the standard
 * `text/x-component` content type. The client's `RedirectErrorBoundary`
 * decodes the digest and performs the navigation.
 */
type BuildRscRedirectFlightStream = (options: {
  digest: string;
}) => ReadableStream<Uint8Array>;
type BuildAppPageSpecialErrorResponseOptions = {
  /**
   * Optional configured basePath (e.g. "/blog"). When set, redirect Locations
   * pointing at app-internal paths get prefixed so callers see e.g.
   * `Location: /blog/about` for `redirect("/about")`. Mirrors Next.js's
   * `addPathPrefix(getURLFromRedirectError(err), basePath)` in app-render.tsx.
   * External URLs (those that resolve to a different origin than the request)
   * are left untouched.
   */
  basePath?: string;
  /**
   * Builds the RSC flight payload used when a redirect must be encoded inside
   * the response body instead of the status line — required for RSC navigations
   * and for `generateMetadata()` redirects (always 200, never 307). When
   * omitted, redirect responses fall back to the 307 + Location path; callers
   * that handle RSC requests must supply this.
   */
  buildRscRedirectFlightStream?: BuildRscRedirectFlightStream;
  clearRequestContext: () => void;
  /**
   * Drains and returns Set-Cookie header values that were accumulated during
   * this render via cookies().set() / cookies().delete(). Appended to redirect
   * responses so an auth flow that does `cookies().set("session", "...");
   * redirect("/")` preserves the cookie on the 307. Mirrors Next.js's
   * `appendMutableCookies(headers, requestStore.mutableCookies)` in
   * app-render.tsx. Only applied to redirect responses to match Next.js;
   * the http-access-fallback path leaves cookies to the rendered boundary.
   */
  getAndClearPendingCookies?: () => string[];
  isEdgeRuntime?: boolean;
  isRscRequest: boolean;
  middlewareContext?: {
    headers: Headers | null;
  };
  renderFallbackPage?: (statusCode: number) => Promise<Response | null>;
  request: Request;
  serveStreamingMetadata?: boolean;
  specialError: AppPageSpecialError;
};
type ProbeAppPageLayoutsResult = {
  response: Response | null;
  layoutFlags: LayoutFlags;
};
type LayoutClassificationOptions = {
  /** Build-time classifications from segment config or module graph, keyed by layout index. */buildTimeClassifications?: ReadonlyMap<number, "static" | "dynamic"> | null;
  /**
   * Per-layout classification reasons keyed by layout index. Requires
   * `VINEXT_DEBUG_CLASSIFICATION` at BOTH lifecycle points: at build time so
   * the plugin patches the `__VINEXT_CLASS_REASONS` dispatch stub, and at
   * runtime so the route object actually calls it. Setting the flag only at
   * runtime leaves the stub returning `null`, and every build-time classified
   * layout will fall through to `{ layer: "no-classifier" }` in the debug
   * channel. The hot path never reads this and the wire payload is unchanged.
   */
  buildTimeReasons?: ReadonlyMap<number, ClassificationReason> | null;
  /**
   * Emits one log line per layout with the classification reason, keyed by
   * layout ID. Set by the generator when `VINEXT_DEBUG_CLASSIFICATION` is
   * active. When undefined, the probe loop skips debug emission entirely.
   */
  debugClassification?: (layoutId: string, reason: ClassificationReason) => void; /** Maps layout index to its layout ID (e.g. "layout:/blog"). */
  getLayoutId: (layoutIndex: number) => string;
  /**
   * Returns whether the completed per-layout observation makes static reuse
   * unsafe even if the older dynamic scope did not report dynamic usage.
   */
  isLayoutObservationDynamic?: (layoutId: string) => boolean; /** Runs a function with isolated dynamic usage tracking per layout. */
  runWithIsolatedDynamicScope: <T>(fn: () => T | Promise<T>) => Promise<{
    result: T;
    dynamicDetected: boolean;
  }>;
};
type ProbeAppPageLayoutsOptions = {
  layoutCount: number;
  onLayoutError: (error: unknown, layoutIndex: number) => Promise<Response | null>;
  probeLayoutAt: (layoutIndex: number) => unknown;
  runWithSuppressedHookWarning<T>(probe: () => Promise<T>): Promise<T>; /** When provided, enables per-layout static/dynamic classification. */
  classification?: LayoutClassificationOptions | null;
};
type ProbeAppPageComponentOptions = {
  awaitAsyncResult: boolean;
  onError: (error: unknown) => Promise<Response | null>;
  probePage: () => unknown;
  runWithSuppressedHookWarning<T>(probe: () => Promise<T>): Promise<T>;
};
type ProbeAppPageThrownErrorOptions = {
  probePage: () => unknown;
  runWithSuppressedHookWarning<T>(probe: () => Promise<T>): Promise<T>;
};
declare function resolveAppPageSpecialError(error: unknown): AppPageSpecialError | null;
declare function buildAppPageSpecialErrorResponse(options: BuildAppPageSpecialErrorResponseOptions): Promise<Response>;
/** See `LayoutFlags` type docblock in app-elements.ts for lifecycle. */
declare function probeAppPageLayouts(options: ProbeAppPageLayoutsOptions): Promise<ProbeAppPageLayoutsResult>;
declare function probeAppPageComponent(options: ProbeAppPageComponentOptions): Promise<Response | null>;
declare function probeAppPageThrownError(options: ProbeAppPageThrownErrorOptions): Promise<unknown>;
declare function readAppPageBinaryStream(stream: ReadableStream<Uint8Array>): Promise<ArrayBuffer>;
declare function bufferAppPageBinaryStream(stream: ReadableStream<Uint8Array>): Promise<ReadableStream<Uint8Array>>;
declare function teeAppPageRscStreamForCapture(stream: ReadableStream<Uint8Array>, shouldCapture: boolean): AppPageRscStreamCapture;
declare function buildAppPageFontLinkHeader(preloads: readonly AppPageFontPreload[] | null | undefined): string;
//#endregion
export { AppPageFontPreload, AppPageSpecialError, LayoutClassificationOptions, type LayoutFlags, bufferAppPageBinaryStream, buildAppPageFontLinkHeader, buildAppPageSpecialErrorResponse, probeAppPageComponent, probeAppPageLayouts, probeAppPageThrownError, readAppPageBinaryStream, resolveAppPageSpecialError, tagAppPageMetadataError, teeAppPageRscStreamForCapture };