import { Route } from "../routing/pages-router.js";
import { VinextNextData } from "../client/vinext-next-data.js";
import { CachedPagesValue } from "../shims/cache-handler.js";
import { ISRCacheEntry } from "./isr-cache.js";
import { PagesPreviewData } from "./pages-preview.js";
import { PagesGetInitialPropsRouter } from "./pages-get-initial-props.js";
import { PagesGsspResponse, PagesI18nRenderContext, PagesNextDataExtras } from "./pages-page-response.js";
import { ReactNode } from "react";

//#region src/server/pages-page-data.d.ts
type PagesRedirectResult = {
  destination: string;
  permanent?: boolean;
  statusCode?: number;
};
type PagesStaticPathsEntry = string | {
  params?: Record<string, unknown>;
  locale?: string;
};
type PagesStaticPathsResult = {
  fallback?: boolean | "blocking";
  paths?: PagesStaticPathsEntry[];
};
type PagesPagePropsResult = {
  props?: Record<string, unknown>;
  redirect?: PagesRedirectResult;
  notFound?: boolean;
  revalidate?: number;
};
type PagesMutableGsspResponse = {
  headersSent: boolean;
} & PagesGsspResponse;
type PagesGsspContextResponse = {
  req: unknown;
  res: PagesMutableGsspResponse;
  responsePromise: Promise<Response>;
};
type PagesRenderProps = Record<string, unknown> & {
  pageProps: unknown;
};
type PagesPageModule = {
  default?: unknown;
  getStaticPaths?: (context: {
    locales: string[];
    defaultLocale: string;
  }) => Promise<PagesStaticPathsResult> | PagesStaticPathsResult;
  /**
   * Pages Router data-fetching context.
   *
   * `params` is `null` for non-dynamic routes (no `[param]` segments) to
   * match Next.js. User code typically falls back via `params || null`, so
   * passing `null` (rather than `{}`) is required for the value to be
   * observable as `null` once the data flows through to the page props.
   *
   * See: test/e2e/edge-pages-support/index.test.ts in Next.js for the
   * authoritative assertion (`expect(props.params).toBe(null)`).
   */
  getServerSideProps?: (context: {
    params: Record<string, unknown> | null;
    req: unknown;
    res: PagesMutableGsspResponse;
    query: Record<string, unknown>;
    resolvedUrl: string;
    locale?: string;
    locales?: string[];
    defaultLocale?: string;
    draftMode?: true;
    preview?: true;
    previewData?: PagesPreviewData;
  }) => Promise<PagesPagePropsResult> | PagesPagePropsResult;
  getStaticProps?: (context: {
    params: Record<string, unknown> | null;
    locale?: string;
    locales?: string[];
    defaultLocale?: string;
    draftMode?: true;
    preview?: true;
    previewData?: PagesPreviewData;
    /**
     * Indicates why `getStaticProps` was invoked.
     *
     * - `"build"`: initial build-time prerender (before runtime traffic).
     * - `"on-demand"`: triggered by `res.revalidate()` from an API route.
     * - `"stale"`: stale-while-revalidate background regeneration.
     *
     * Mirrors Next.js `render.tsx`'s `revalidateReason` on the
     * `GetStaticPropsContext` type — see
     * `.nextjs-ref/packages/next/src/types.ts`.
     */
    revalidateReason?: "build" | "on-demand" | "stale";
  }) => Promise<PagesPagePropsResult> | PagesPagePropsResult;
};
type RenderPagesIsrHtmlOptions = {
  buildId: string | null;
  cachedHtml: string;
  createPageElement: (props: Record<string, unknown>) => ReactNode;
  i18n: PagesI18nRenderContext;
  pageProps: Record<string, unknown>;
  props?: Record<string, unknown>;
  params: Record<string, unknown>;
  renderIsrPassToStringAsync: (element: ReactNode) => Promise<string>;
  routePattern: string;
  safeJsonStringify: (value: unknown) => string;
  vinext?: VinextNextData["__vinext"];
  nextData?: PagesNextDataExtras;
};
type ResolvePagesPageDataOptions = {
  applyRequestContexts: () => void;
  buildId: string | null;
  /**
   * When true, this is a `/_next/data/<buildId>/<page>.json` request. Callers
   * that respond with a JSON envelope (`{ pageProps }`) instead of HTML must
   * bypass the HTML ISR cache: a cached HTML body cannot be reshaped into the
   * expected JSON shape, and storing JSON in the HTML cache would corrupt
   * subsequent HTML hits. Next.js handles this the same way — see
   * `isNextDataRequest` checks in `packages/next/src/server/base-server.ts`.
   */
  isDataReq?: boolean;
  err?: unknown;
  createGsspReqRes: () => PagesGsspContextResponse;
  createAppTree?: (props: Record<string, unknown>) => ReactNode;
  createPageElement: (props: Record<string, unknown>) => ReactNode;
  fontLinkHeader: string;
  i18n: PagesI18nRenderContext;
  isrCacheKey: (router: string, pathname: string) => string;
  isrGet: (key: string) => Promise<ISRCacheEntry | null>;
  isrSet: (key: string, data: CachedPagesValue, revalidateSeconds: number, tags?: string[], expireSeconds?: number) => Promise<void>;
  expireSeconds?: number;
  /**
   * When true, this dispatch corresponds to a build-time prerender (the
   * `vinext` build phase fetches each statically generated page through the
   * production server). Maps to `revalidateReason: "build"` when
   * `getStaticProps` is invoked. Mirrors Next.js's
   * `renderOpts.isBuildTimePrerendering` flag — see
   * `.nextjs-ref/packages/next/src/server/render.tsx`.
   */
  isBuildTimePrerendering?: boolean;
  validatePropsSerialization?: boolean;
  /**
   * When true, this dispatch was triggered by an on-demand revalidation
   * request (e.g. `res.revalidate()` in a Pages Router API route, or an
   * equivalent webhook). Maps to `revalidateReason: "on-demand"` when
   * `getStaticProps` is invoked, and bypasses the fresh/stale cache-hit
   * short-circuits so the entry is regenerated synchronously. Mirrors Next.js's
   * `renderOpts.isOnDemandRevalidate` flag — see
   * `.nextjs-ref/packages/next/src/server/render.tsx`.
   *
   * The page handler sets this only when the incoming request's
   * `x-prerender-revalidate` header (`PRERENDER_REVALIDATE_HEADER`) *equals* the
   * process revalidate secret that `res.revalidate()` attaches to its internal
   * request (`isOnDemandRevalidateRequest`). It is never set on mere header
   * presence — see the security note in `isr-cache.ts`.
   */
  isOnDemandRevalidate?: boolean;
  previewData?: PagesPreviewData | false;
  /**
   * The deployment ID used for deployment-skew protection. When set, it is
   * included as `x-nextjs-deployment-id` on all `_next/data` responses
   * (success, redirect, notFound). Mirrors Next.js pages-handler.ts behavior.
   * Typically sourced from `process.env.__VINEXT_DEPLOYMENT_ID || process.env.NEXT_DEPLOYMENT_ID`.
   */
  deploymentId?: string;
  htmlLimitedBots?: string;
  pageModule: PagesPageModule;
  AppComponent?: unknown; /** The request-scoped `next/router` server instance when available. */
  router?: PagesGetInitialPropsRouter;
  params: Record<string, unknown>;
  query: Record<string, unknown>;
  asPath?: string;
  resolvedUrl?: string;
  route: Pick<Route, "isDynamic">;
  routePattern: string;
  routeUrl: string;
  runInFreshUnifiedContext: <T>(callback: () => Promise<T>) => Promise<T>;
  safeJsonStringify: (value: unknown) => string;
  sanitizeDestination: (destination: string) => string;
  scriptNonce?: string;
  statusCode?: number;
  triggerBackgroundRegeneration: (key: string, renderFn: () => Promise<void>, errorContext?: {
    routerKind: "Pages Router";
    routePath: string;
    routeType: "render";
  }) => void;
  renderIsrPassToStringAsync: (element: ReactNode) => Promise<string>;
  vinext?: VinextNextData["__vinext"];
  nextData?: PagesNextDataExtras;
  /**
   * The request's User-Agent string. When this matches a known crawler/bot
   * pattern, ISR cache-HIT and cache-STALE responses receive an ETag header
   * for consistency with the fresh-MISS path (which also attaches an ETag for
   * bot UAs via `renderPagesPageResponse`). See the divergence note in
   * `pages-page-response.ts` for why UA-gating is used instead of Next.js's
   * `isDynamic` check.
   */
  userAgent?: string;
  /**
   * The incoming request's `If-None-Match` header value. When the cached HTML
   * ETag matches (weak-ETag semantics), the ISR cache-HIT or cache-STALE
   * response is a `304 Not Modified` with no body.
   */
  ifNoneMatch?: string;
  /**
   * The incoming request's `Cache-Control` header value. When it contains
   * `no-cache`, the 304 short-circuit is skipped and a full response is
   * returned — mirroring the `fresh` package used by Next.js.
   */
  requestCacheControl?: string;
};
type ResolvePagesPageDataRenderResult = {
  kind: "render";
  documentReqRes: PagesGsspContextResponse | null;
  gsspRes: PagesGsspResponse | null;
  isrRevalidateSeconds: number | null;
  pageProps: Record<string, unknown>;
  props: PagesRenderProps;
  /**
   * True when `getStaticPaths` returned `fallback: true` AND the requested path
   * is not in the pre-rendered list. The caller renders a loading shell with
   * empty props and `useRouter().isFallback === true` (matching Next.js's
   * `render.tsx` — `getStaticProps` is skipped on the fallback render).
   */
  isFallback: boolean;
};
type ResolvePagesPageDataResponseResult = {
  kind: "response";
  response: Response;
};
type ResolvePagesPageDataNotFoundResult = {
  kind: "notFound";
};
type ResolvePagesPageDataResult = ResolvePagesPageDataRenderResult | ResolvePagesPageDataResponseResult | ResolvePagesPageDataNotFoundResult;
/**
 * Compare a `getStaticPaths` entry against the actual request params.
 *
 * Handles both shapes Next.js allows:
 *   - { params: { ... } }
 *   - "string-path"
 *
 * For a string entry, compare the entry against the current request URL using
 * the shared `normalizeStaticPathname` helper from
 * `../routing/route-pattern.ts` (which mirrors the Next.js
 * `removeTrailingSlash` behaviour in
 * `.nextjs-ref/packages/next/src/build/static-paths/pages.ts`). For an object
 * entry with a missing `params` key, return false rather than throwing — the
 * caller will respond with a 404 just like Next.js does for unlisted paths.
 */
type PagesRouteParam = {
  key: string;
  repeat: boolean;
  optional: boolean;
};
declare function getPagesRouteParams(routePattern: string): PagesRouteParam[];
declare function matchesPagesStaticPath(pathEntry: PagesStaticPathsEntry, params: Record<string, unknown>, routeParams: PagesRouteParam[], routeUrl: string): boolean;
declare function renderPagesIsrHtml(options: RenderPagesIsrHtmlOptions): Promise<string>;
declare function resolvePagesPageData(options: ResolvePagesPageDataOptions): Promise<ResolvePagesPageDataResult>;
//#endregion
export { PagesPageModule, PagesRouteParam, PagesStaticPathsEntry, ResolvePagesPageDataOptions, getPagesRouteParams, matchesPagesStaticPath, renderPagesIsrHtml, resolvePagesPageData };