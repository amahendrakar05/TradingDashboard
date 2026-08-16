import { NextRouter } from "../shims/router.js";

//#region src/server/pages-get-initial-props.d.ts
type PagesGetInitialPropsContext = {
  req?: unknown;
  res?: unknown;
  err?: unknown;
  pathname?: string;
  query?: Record<string, unknown>;
  asPath?: string;
  locale?: string;
  locales?: string[];
  defaultLocale?: string;
} & Record<string, unknown>;
type PagesGetInitialPropsRouter = Omit<Pick<NextRouter, "route" | "pathname" | "query" | "asPath">, "query"> & {
  query: Record<string, unknown>;
};
/**
 * Build the URL-state subset of Next.js's ServerRouter used by isolated
 * initial-props helpers. Real request handlers pass their full `next/router`
 * instance; this fallback keeps direct helper callers and tests aligned with
 * the same required fields.
 */
declare function createPagesGetInitialPropsRouter(pathname: string, query: Record<string, unknown>, asPath: string): PagesGetInitialPropsRouter;
declare function hasPagesGetInitialProps(component: unknown): boolean;
declare function isResponseSent(res: unknown): boolean;
declare function loadPagesGetInitialProps(component: unknown, context: PagesGetInitialPropsContext): Promise<Record<string, unknown> | null>;
/**
 * Decision returned by {@link loadDevAppInitialProps}.
 *
 * - `skip`: the custom `App` has no `getInitialProps`; the caller renders with
 *   its existing props unchanged.
 * - `response-sent`: `_app.getInitialProps` ended the response itself (wrote
 *   headers / body); the caller must stop and not render.
 * - `render`: the caller should render with the returned `pageProps` /
 *   `renderProps`.
 */
type DevAppInitialPropsResult = {
  kind: "skip";
} | {
  kind: "response-sent";
} | {
  kind: "render";
  pageProps: Record<string, unknown>;
  renderProps: Record<string, unknown> & {
    pageProps: unknown;
  };
};
type DevAppInitialPropsContext = {
  appComponent: unknown;
  /**
   * Builds the `AppTree` element passed to `getInitialProps`. Injected so this
   * module stays free of React; the dev SSR handler supplies the real
   * `React.createElement` closure.
   */
  appTree: (appTreeProps: Record<string, unknown>) => unknown;
  component: unknown;
  req: unknown;
  res: unknown;
  pathname: string;
  query: Record<string, unknown>;
  asPath: string; /** The request-scoped `next/router` server instance when available. */
  router?: PagesGetInitialPropsRouter;
  locale?: string;
  locales?: string[];
  defaultLocale?: string;
};
/**
 * Run the custom `App`'s `getInitialProps` for the dev SSR render path and
 * return a decision the caller applies.
 *
 * This is the dev-server counterpart to the production page-data resolver's
 * app-initial-props loading. It is invoked lazily — only when a request is
 * actually going to render (cache miss / on-demand revalidation), never on an
 * ISR cache HIT/STALE that serves cached HTML verbatim — so userland `App`
 * data code does not run on the cache hot path.
 */
declare function loadDevAppInitialProps(ctx: DevAppInitialPropsContext): Promise<DevAppInitialPropsResult>;
//#endregion
export { DevAppInitialPropsContext, DevAppInitialPropsResult, PagesGetInitialPropsRouter, createPagesGetInitialPropsRouter, hasPagesGetInitialProps, isResponseSent, loadDevAppInitialProps, loadPagesGetInitialProps };