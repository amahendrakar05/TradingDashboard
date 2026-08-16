import { VinextLinkPrefetchRoute } from "../client/vinext-next-data.js";
import { UrlObject } from "node:url";
import React, { AnchorHTMLAttributes } from "react";

//#region src/shims/link.d.ts
type LinkProps<_RouteInferType = unknown> = {
  href: string | UrlObject; /** URL displayed in the browser (when href is a route pattern like /user/[id]) */
  as?: string | UrlObject; /** Replace the current history entry instead of pushing */
  replace?: boolean; /** Prefetch the page in the background (App Router default: auto, Pages Router default: true) */
  prefetch?: boolean | "auto" | null;
  /**
   * Unstable App Router option matching Next.js canary: an automatic prefetch
   * is upgraded to a full prefetch when the user shows navigation intent.
   */
  unstable_dynamicOnHover?: boolean; /** Whether to pass the href to the child element */
  passHref?: boolean;
  /**
   * Pre-Next.js-13 link behaviour. When true, <Link> expects its child to be
   * an `<a>` (or a component that renders one) and forwards `href`, click,
   * and prefetch handlers to the child via `React.cloneElement` instead of
   * rendering its own wrapping `<a>`. Required when the user wants to
   * style/instrument the anchor themselves.
   */
  legacyBehavior?: boolean; /** Scroll to top on navigation (default: true) */
  scroll?: boolean;
  /**
   * Pages Router: update the URL without re-running data fetching methods
   * (getServerSideProps / getStaticProps / getInitialProps). The shallow change
   * still triggers the route change events and updates `router.query`. Only
   * applies to navigations within the same page. No-op on the App Router.
   */
  shallow?: boolean; /** Locale for i18n (used for locale-prefixed URLs) */
  locale?: string | false; /** Called before navigation happens (Next.js 16). Return value is ignored. */
  onNavigate?: (event: {
    preventDefault(): void;
  }) => void;
  transitionTypes?: string[];
  children?: React.ReactNode;
} & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href">;
type LinkPrefetchMode = "disabled" | "auto" | "full" | "full-after-shell";
declare global {
  interface Window {
    __VINEXT_LINK_PREFETCH_ROUTES__?: VinextLinkPrefetchRoute[];
  }
}
type LinkStatusContextValue = {
  pending: boolean;
};
/**
 * useLinkStatus returns the pending state of the enclosing <Link>.
 * In Next.js, this is used to show loading indicators while a
 * prefetch-triggered navigation is in progress.
 */
declare function useLinkStatus(): LinkStatusContextValue;
declare function resolveLinkPrefetchMode(prefetchProp: LinkProps["prefetch"], isDangerous: boolean): LinkPrefetchMode;
declare function canAutoPrefetchFullAppRoute(href: string): boolean;
declare function resolveAutoAppRoutePrefetch(href: string): {
  cacheForNavigation: boolean;
  prefetchShellFirst: boolean;
  shouldPrefetch: boolean;
};
declare const Link: React.ForwardRefExoticComponent<{
  href: string | UrlObject; /** URL displayed in the browser (when href is a route pattern like /user/[id]) */
  as?: string | UrlObject; /** Replace the current history entry instead of pushing */
  replace?: boolean; /** Prefetch the page in the background (App Router default: auto, Pages Router default: true) */
  prefetch?: boolean | "auto" | null;
  /**
   * Unstable App Router option matching Next.js canary: an automatic prefetch
   * is upgraded to a full prefetch when the user shows navigation intent.
   */
  unstable_dynamicOnHover?: boolean; /** Whether to pass the href to the child element */
  passHref?: boolean;
  /**
   * Pre-Next.js-13 link behaviour. When true, <Link> expects its child to be
   * an `<a>` (or a component that renders one) and forwards `href`, click,
   * and prefetch handlers to the child via `React.cloneElement` instead of
   * rendering its own wrapping `<a>`. Required when the user wants to
   * style/instrument the anchor themselves.
   */
  legacyBehavior?: boolean; /** Scroll to top on navigation (default: true) */
  scroll?: boolean;
  /**
   * Pages Router: update the URL without re-running data fetching methods
   * (getServerSideProps / getStaticProps / getInitialProps). The shallow change
   * still triggers the route change events and updates `router.query`. Only
   * applies to navigations within the same page. No-op on the App Router.
   */
  shallow?: boolean; /** Locale for i18n (used for locale-prefixed URLs) */
  locale?: string | false; /** Called before navigation happens (Next.js 16). Return value is ignored. */
  onNavigate?: (event: {
    preventDefault(): void;
  }) => void;
  transitionTypes?: string[];
  children?: React.ReactNode;
} & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & React.RefAttributes<HTMLAnchorElement>>;
//#endregion
export { LinkProps, canAutoPrefetchFullAppRoute, Link as default, resolveAutoAppRoutePrefetch, resolveLinkPrefetchMode, useLinkStatus };