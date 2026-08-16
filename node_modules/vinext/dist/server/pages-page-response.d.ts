import { VinextNextData } from "../client/vinext-next-data.js";
import { CachedPagesValue } from "../shims/cache-handler.js";
import { RenderPageEnhancers } from "./pages-document-initial-props.js";
import { ComponentType, ReactNode } from "react";

//#region src/server/pages-page-response.d.ts
/**
 * Returns true when the User-Agent belongs to a bot or crawler that cannot
 * reliably consume a streamed HTML response.
 */
declare function isPagesStreamingBot(userAgent: string): boolean;
declare function generatePagesETag(payload: string): string;
/**
 * Mirrors Next.js `sendEtagResponse` semantics (weak/strong comparison).
 *
 * A weak ETag `W/"..."` matches both `W/"..."` and `"..."` in `If-None-Match`.
 * A strong ETag `"..."` only matches the same strong token.
 * `*` always matches.
 */
declare function etagMatches(etag: string, ifNoneMatch: string): boolean;
/**
 * Returns true when a request `Cache-Control` header asks to bypass the 304
 * short-circuit. Mirrors the `fresh` package's check used by Next.js's
 * `sendEtagResponse` (`/(?:^|,)\s*?no-cache\s*?(?:,|$)/`). Shared by the
 * fresh-MISS bot path here and the ISR HIT/STALE paths in
 * `pages-page-data.ts` so the two cannot drift.
 */
declare function requestsNoCache(cacheControl: string | undefined): boolean;
type PagesFontPreload = {
  href: string;
  type: string;
};
/**
 * The `__NEXT_DATA__` fields beyond the always-present core that the Pages
 * renderer serializes: the `__vinext` block plus the readiness flags
 * (gssp/gsp/gip/appGip/autoExport/nextExport/isExperimentalCompile) the client uses to
 * recompute the initial `router.isReady`. Shared by every render path
 * (initial, ISR regeneration) so they emit identical readiness state.
 */
type PagesNextDataExtras = Pick<VinextNextData, "__vinext" | "appGip" | "autoExport" | "gip" | "gsp" | "gssp" | "isExperimentalCompile" | "nextExport">;
type PagesI18nRenderContext = {
  locale?: string;
  locales?: string[];
  defaultLocale?: string;
  domainLocales?: unknown;
};
type PagesGsspResponse = {
  headersSent?: boolean;
  statusCode: number;
  getHeaders(): Record<string, string | number | boolean | string[]>;
};
type PagesDocumentReqRes = {
  req: unknown;
  res: PagesGsspResponse;
  responsePromise?: Promise<Response>;
};
type RenderPagesPageResponseOptions = {
  assetTags: string;
  buildId: string | null;
  clearSsrContext: () => void;
  createPageElement: (pageProps: Record<string, unknown>) => ReactNode;
  /**
   * Build the page React tree with optional App/Component enhancers applied,
   * supporting the Pages Router `_document.getInitialProps` contract:
   *
   *   ctx.renderPage({ enhanceApp, enhanceComponent })
   *
   * Used by CSS-in-JS libraries (styled-components, emotion) to wrap the
   * App/Component tree so styles can be collected during SSR. When omitted,
   * `renderPage` falls back to rendering the plain `createPageElement` tree
   * (enhancers are ignored).
   */
  enhancePageElement?: ((opts: RenderPageEnhancers) => ReactNode) | undefined;
  DocumentComponent: ComponentType | null;
  err?: Error;
  flushPreloads?: (() => Promise<void> | void) | undefined;
  fontLinkHeader: string;
  fontPreloads: PagesFontPreload[];
  getFontLinks: () => string[];
  getFontStyles: () => string[];
  getSSRHeadHTML?: (() => string) | undefined;
  /**
   * Allow-list of OpenTelemetry propagation keys (from
   * `experimental.clientTraceMetadata`) to emit as `<meta>` tags in the SSR
   * head. Undefined or empty disables emission.
   */
  clientTraceMetadata?: readonly string[] | undefined;
  setDocumentInitialHead?: ((head: ReactNode[]) => void) | undefined;
  documentReqRes?: PagesDocumentReqRes | null;
  gsspRes: PagesGsspResponse | null;
  isrCacheKey: (router: string, pathname: string) => string;
  expireSeconds?: number;
  isrRevalidateSeconds: number | null;
  isStaticPropsRoute?: boolean;
  isrSet: (key: string, data: CachedPagesValue, revalidateSeconds: number, tags?: string[], expireSeconds?: number) => Promise<void>;
  i18n: PagesI18nRenderContext;
  /**
   * True when rendering a `getStaticPaths` fallback shell for a path that
   * isn't pre-rendered (`fallback: true` + unlisted path). Forwarded to
   * `buildPagesNextDataScript` so the client serialises `isFallback: true`
   * into `__NEXT_DATA__`, then later hydrates by fetching the data URL.
   */
  isFallback?: boolean;
  pageProps: Record<string, unknown>;
  props?: Record<string, unknown>;
  params: Record<string, unknown>;
  query?: Record<string, unknown>;
  renderDocumentToString: (element: ReactNode) => Promise<string>;
  renderToReadableStream: (element: ReactNode) => Promise<ReadableStream<Uint8Array>>;
  resetSSRHead?: (() => void) | undefined;
  routePattern: string;
  routeUrl: string;
  safeJsonStringify: (value: unknown) => string;
  scriptNonce?: string;
  statusCode?: number;
  vinext?: VinextNextData["__vinext"];
  nextData?: PagesNextDataExtras;
  /**
   * The request's User-Agent string (from `request.headers.get('user-agent')`).
   * When this matches a known crawler / bot pattern, the response is fully
   * buffered before sending so bots receive a single complete HTML chunk with
   * an ETag header. Omitting this field disables bot-detection (streaming as
   * normal), which is the correct behaviour for non-HTML requests and tests.
   */
  userAgent?: string;
  /**
   * The incoming request's `If-None-Match` header value. When set and the
   * computed ETag matches (weak-ETag semantics, mirroring Next.js's
   * `sendEtagResponse`), a `304 Not Modified` is returned with an empty body.
   * Only evaluated on bot/buffered responses that carry an ETag.
   */
  ifNoneMatch?: string;
  /**
   * The incoming request's `Cache-Control` header value. When the value
   * contains `no-cache`, the 304 short-circuit is skipped and a full 200
   * response is always returned — mirroring the `fresh` package used by
   * Next.js's `sendEtagResponse`.
   */
  requestCacheControl?: string;
};
declare function buildPagesNextDataScript(options: Pick<RenderPagesPageResponseOptions, "buildId" | "i18n" | "isFallback" | "pageProps" | "props" | "params" | "routePattern" | "safeJsonStringify" | "scriptNonce" | "nextData"> & {
  vinext?: VinextNextData["__vinext"];
}): string;
declare function renderPagesPageResponse(options: RenderPagesPageResponseOptions): Promise<Response>;
//#endregion
export { PagesGsspResponse, PagesI18nRenderContext, PagesNextDataExtras, buildPagesNextDataScript, etagMatches, generatePagesETag, isPagesStreamingBot, renderPagesPageResponse, requestsNoCache };