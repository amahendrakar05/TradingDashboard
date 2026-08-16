//#region src/shims/link-prefetch.d.ts
type LinkPrefetchIntent = "viewport" | "intent";
type LinkPrefetchPriority = "low" | "high";
type LinkPrefetchRouterMode = "app" | "pages";
type LinkPrefetchDecision = {
  shouldPrefetch: false;
} | {
  shouldPrefetch: true;
  priority: LinkPrefetchPriority;
};
declare function canLinkPrefetch(input: {
  nodeEnv: string | undefined;
  prefetch: boolean | "auto" | null | undefined;
  isDangerous: boolean;
}): boolean;
declare function canLinkIntentPrefetch(input: {
  nodeEnv: string | undefined;
  prefetch: boolean | "auto" | null | undefined;
  isDangerous: boolean;
  routerMode: LinkPrefetchRouterMode;
}): boolean;
declare function getLinkPrefetchDecision(input: {
  nodeEnv: string | undefined;
  prefetch: boolean | "auto" | null | undefined;
  isDangerous: boolean;
  intent: LinkPrefetchIntent;
  routerMode?: LinkPrefetchRouterMode;
}): LinkPrefetchDecision;
/**
 * Normalize absolute and protocol-relative Link hrefs to app-relative paths
 * that are eligible for prefetching. Non-absolute relative hrefs are returned
 * unchanged; callers must resolve them against the current browser URL before
 * constructing a concrete fetch target.
 */
declare function getLinkPrefetchHref(input: {
  href: string;
  basePath: string;
  currentOrigin: string | undefined;
}): string | null;
//#endregion
export { LinkPrefetchDecision, LinkPrefetchIntent, LinkPrefetchPriority, LinkPrefetchRouterMode, canLinkIntentPrefetch, canLinkPrefetch, getLinkPrefetchDecision, getLinkPrefetchHref };