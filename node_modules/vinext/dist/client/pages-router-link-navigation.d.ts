//#region src/client/pages-router-link-navigation.d.ts
type PagesRouterLinkTransitionOptions = {
  scroll?: boolean;
  shallow?: boolean;
  locale?: string | false;
  _vinextInterpolateDynamicRoute?: boolean;
};
type PagesRouterLinkRuntime = {
  push(url: string, as?: string, options?: PagesRouterLinkTransitionOptions): Promise<boolean>;
  replace(url: string, as?: string, options?: PagesRouterLinkTransitionOptions): Promise<boolean>;
};
type PagesRouterLinkNavigation = {
  href: string;
  /**
   * Optional `as` mask — the browser-bar URL when it differs from `href`
   * (a Pages Router route pattern, e.g. `<Link href="/posts/[id]" as="/posts/1">`).
   * When present, `router.push/replace(href, as, ...)` is invoked with both
   * values so the upstream (url, as) pair survives end-to-end. Mirrors
   * Next.js's Link → Router contract: packages/next/src/client/link.tsx
   * → router.push(href, as).
   */
  as?: string;
  replace: boolean;
  scroll: boolean;
  shallow?: boolean;
  locale?: string | false;
  interpolateDynamicRoute?: boolean;
};
declare function resolvePagesRouterQueryOnlyHref(href: string, {
  asPath,
  basePath,
  fallbackHref,
  locales
}: {
  asPath?: string;
  basePath: string;
  fallbackHref: string;
  locales?: readonly string[];
}): string;
declare function navigatePagesRouterLink(router: PagesRouterLinkRuntime, {
  href,
  as,
  replace,
  scroll,
  shallow,
  locale,
  interpolateDynamicRoute
}: PagesRouterLinkNavigation): Promise<void>;
declare function navigatePagesRouterLinkWithFallback({
  router,
  loadRouter,
  navigation,
  fallback
}: {
  router?: PagesRouterLinkRuntime;
  loadRouter: () => Promise<PagesRouterLinkRuntime | undefined>;
  navigation: PagesRouterLinkNavigation;
  fallback: () => void;
}): Promise<void>;
//#endregion
export { navigatePagesRouterLink, navigatePagesRouterLinkWithFallback, resolvePagesRouterQueryOnlyHref };