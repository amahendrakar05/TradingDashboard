import { VinextNextData } from "../client/vinext-next-data.js";
import { isExternalUrl } from "../utils/external-url.js";
import { PagesRouterComponentsMap } from "./internal/pages-router-components.js";
import { UrlObject } from "node:url";
import { ComponentType, ReactElement } from "react";
import { ParsedUrlQuery } from "node:querystring";
import { BaseContext, NextComponentType, NextPageContext } from "@vinext/types/next/upstream/dist/shared/lib/utils";

//#region src/shims/router.d.ts
type BeforePopStateCallback = (state: {
  url: string;
  as: string;
  options: TransitionOptions;
}) => boolean;
type NextRouter = {
  /** Current pathname */pathname: string; /** Current route pattern (e.g., "/posts/[id]") */
  route: string; /** Query parameters */
  query: ParsedUrlQuery; /** Full URL including query string */
  asPath: string; /** Base path */
  basePath: string; /** Current locale */
  locale?: string; /** Available locales */
  locales?: readonly string[]; /** Default locale */
  defaultLocale?: string; /** Configured domain locales */
  domainLocales?: VinextNextData["domainLocales"]; /** Whether the active hostname matches a configured locale domain */
  isLocaleDomain: boolean; /** Whether the router is ready */
  isReady: boolean; /** Whether this is a preview */
  isPreview: boolean; /** Whether this is a fallback page */
  isFallback: boolean; /** Navigate to a new URL */
  push(url: string | UrlObject$1, as?: string, options?: TransitionOptions): Promise<boolean>; /** Replace current URL */
  replace(url: string | UrlObject$1, as?: string, options?: TransitionOptions): Promise<boolean>; /** Go back */
  back(): void; /** Go forward */
  forward(): void; /** Reload the page */
  reload(): void; /** Prefetch a page (injects <link rel="prefetch">) */
  prefetch(url: string, as?: string): Promise<void>; /** Register a callback to run before popstate navigation */
  beforePopState(cb: BeforePopStateCallback): void; /** Listen for route changes */
  events: RouterEvents;
};
type UrlObject$1 = UrlObject;
type TransitionOptions = {
  _h?: 1;
  shallow?: boolean;
  scroll?: boolean;
  locale?: string | false;
  _vinextInterpolateDynamicRoute?: boolean;
};
type RouterEvents = {
  on(event: string, handler: (...args: unknown[]) => void): void;
  off(event: string, handler: (...args: unknown[]) => void): void;
  emit(event: string, ...args: unknown[]): void;
};
/**
 * Apply locale prefix to a URL for client-side navigation.
 * Same logic as Link's applyLocaleToHref but reads from window globals.
 */
declare function applyNavigationLocale(url: string, locale?: string, replaceExistingLocale?: boolean): string;
/** Check if a href is only a hash change relative to the current URL */
declare function isHashOnlyChange(href: string): boolean;
/**
 * SSR context - set by the dev server before rendering each page.
 */
type SSRContext = {
  pathname: string;
  query: Record<string, string | string[]>;
  asPath: string;
  navigationIsReady?: boolean;
  nextData?: VinextNextData;
  locale?: string;
  locales?: string[];
  defaultLocale?: string;
  domainLocales?: VinextNextData["domainLocales"];
  isPreview?: boolean;
  /**
   * True when rendering a `getStaticPaths` fallback shell for a path that
   * hasn't been pre-rendered yet (`fallback: true` + unlisted path). Mirrors
   * `renderContext.isFallback` in Next.js's `render.tsx`: `getStaticProps`
   * is skipped, the page renders with empty props, and `useRouter().isFallback`
   * returns `true` so user code can show a loading state.
   */
  isFallback?: boolean;
};
/**
 * Register ALS-backed state accessors. Called by router-state.ts on import.
 * @internal
 */
declare function _registerRouterStateAccessors(accessors: {
  getSSRContext: () => SSRContext | null;
  setSSRContext: (ctx: SSRContext | null) => void;
}): void;
declare function setSSRContext(ctx: SSRContext | null): void;
type PagesNavigationContextShape = {
  pathname: string | null;
  searchParams: URLSearchParams;
  params: Record<string, string | string[]> | null;
};
/**
 * Cross-router compat shim source for `next/navigation` hooks.
 *
 * Returns the current Pages Router state shaped as a navigation context so
 * the App Router hooks (useParams/useSearchParams/usePathname) can act as
 * compat shims when invoked inside a Pages Router render. Mirrors Next.js's
 * `adaptForPathParams` and `adaptForSearchParams` in
 * .nextjs-ref/packages/next/src/shared/lib/router/adapters.tsx, which Next.js
 * uses to populate SearchParamsContext / PathParamsContext for the Pages
 * Router (see packages/next/src/server/render.tsx and
 * packages/next/src/client/index.tsx).
 *
 * Returns `null` when there is no Pages Router state available — e.g. App
 * Router pages, RSC-only renders, or pre-router renders. Callers should
 * treat null as "App Router context, use normal app-router state".
 */
declare function getPagesNavigationContext(): PagesNavigationContextShape | null;
declare function getPagesNavigationIsReadyFromSerializedState(routePattern: string | undefined, searchString: string, nextData?: VinextNextData): boolean;
declare function markPagesRouterReady(): boolean;
declare function initializePagesRouterReadyFromNextData(nextData: VinextNextData, forceReady?: boolean): void;
/**
 * useRouter hook - Pages Router compatible.
 *
 * Ported from Next.js: packages/next/src/client/router.ts
 * https://github.com/vercel/next.js/blob/canary/packages/next/src/client/router.ts
 */
declare function useRouter(): NextRouter;
/**
 * Wrap a React element in a RouterContext.Provider so that
 * next/compat/router's useRouter() returns the real Pages Router value.
 *
 * The provider owns the reactive Pages Router snapshot so next/router and
 * next/compat/router consumers share one context value instead of each hook
 * installing its own global URL-change listener.
 *
 * The PagesRouterCommitBoundary exists for client navigations: its layout
 * callback runs scroll restoration at commit time and resolves the navigation
 * at the same root-commit boundary Next.js awaits before routeChangeComplete.
 * Its onError rejection drives the hard-navigation fallback in runNavigateClient.
 * The same boundary intentionally also wraps SSR and initial hydration, where
 * callbacks default to noopCommit: a hydration-time render error is caught
 * here (React still console.error's it) instead of propagating, matching the
 * navigation-path containment.
 */
declare function wrapWithRouterContext(element: ReactElement, onCommit?: () => void, onError?: (error: Error) => void): ReactElement;
/**
 * Props injected by `withRouter` into the wrapped component.
 *
 * Ported from Next.js: packages/next/src/client/with-router.tsx
 * https://github.com/vercel/next.js/blob/canary/packages/next/src/client/with-router.tsx
 */
type WithRouterProps = {
  router: NextRouter;
};
/**
 * Pick<P, Exclude<keyof P, keyof WithRouterProps>> — the props of the
 * composed component minus the `router` prop that `withRouter` injects.
 *
 * Ported from Next.js: packages/next/src/client/with-router.tsx
 */
type ExcludeRouterProps<P> = Pick<P, Exclude<keyof P, keyof WithRouterProps>>;
/**
 * Higher-order component that injects the Pages Router `router` instance as
 * a `router` prop into a wrapped component. Primarily used by class
 * components (which cannot call hooks) to access the router. The wrapped
 * component receives the same props as the original, minus `router`, which
 * is filled in by the HOC.
 *
 * Ported from Next.js: packages/next/src/client/with-router.tsx
 * https://github.com/vercel/next.js/blob/canary/packages/next/src/client/with-router.tsx
 *
 * Differences from Next.js:
 * - We type the composed component as `ComponentType<P>` instead of
 *   `NextComponentType<C, any, P>` because vinext does not expose
 *   `NextComponentType` from this shim. The runtime shape (and the props
 *   the wrapper forwards) is identical.
 * - We forward `getInitialProps` and `origGetInitialProps` from the
 *   composed component so `_app` parity holds for class components that
 *   define `getInitialProps`.
 */
declare function withRouter<P extends WithRouterProps, C extends BaseContext = NextPageContext>(ComposedComponent: NextComponentType<C, any, P>): ComponentType<ExcludeRouterProps<P>>;
declare const RouterMethods: {
  router: null;
  readyCallbacks: Array<() => unknown>;
  ready(callback: () => unknown): void; /** See `_components` comment above for the dual role this map plays. */
  components: PagesRouterComponentsMap;
  sdc: Record<string, Promise<Response>>;
  push: (url: string | UrlObject$1, as?: string, options?: TransitionOptions) => Promise<boolean>;
  replace: (url: string | UrlObject$1, as?: string, options?: TransitionOptions) => Promise<boolean>;
  back: () => void;
  forward: () => void;
  reload: () => void;
  prefetch: (url: string, as?: string) => Promise<void>;
  beforePopState: (cb: BeforePopStateCallback) => void;
  events: RouterEvents;
};
declare const singletonRouter: typeof RouterMethods & Omit<NextRouter, keyof typeof RouterMethods>;
/**
 * Constructible named export matching `next/router`'s Router class surface.
 * Vinext owns one browser history runtime, so instances delegate to that
 * shared runtime while preserving the class/static-events API used by apps.
 */
declare class Router {
  static events: RouterEvents;
  constructor(..._args: unknown[]);
  get route(): string;
  get pathname(): string;
  get query(): ParsedUrlQuery;
  get asPath(): string;
  get basePath(): string;
  get locale(): string | undefined;
  get locales(): readonly string[] | undefined;
  get defaultLocale(): string | undefined;
  get domainLocales(): VinextNextData["domainLocales"];
  get isLocaleDomain(): boolean;
  get isReady(): boolean;
  get isPreview(): boolean;
  get isFallback(): boolean;
  get events(): RouterEvents;
  get components(): PagesRouterComponentsMap;
  get sdc(): Record<string, Promise<Response>>;
  push(url: string | UrlObject$1, as?: string, options?: TransitionOptions): Promise<boolean>;
  replace(url: string | UrlObject$1, as?: string, options?: TransitionOptions): Promise<boolean>;
  reload(): void;
  back(): void;
  forward(): void;
  prefetch(url: string, as?: string): Promise<void>;
  beforePopState(cb: BeforePopStateCallback): void;
}
//#endregion
export { ExcludeRouterProps, NextRouter, Router, WithRouterProps, initializePagesRouterReadyFromNextData as _initializePagesRouterReadyFromNextData, markPagesRouterReady as _markPagesRouterReady, _registerRouterStateAccessors, applyNavigationLocale, singletonRouter as default, getPagesNavigationContext, getPagesNavigationIsReadyFromSerializedState, isExternalUrl, isHashOnlyChange, setSSRContext, useRouter, withRouter, wrapWithRouterContext };