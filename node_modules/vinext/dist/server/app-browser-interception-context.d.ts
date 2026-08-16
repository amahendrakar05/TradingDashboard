import { RouteManifest } from "../routing/app-route-graph.js";

//#region src/server/app-browser-interception-context.d.ts
type ResolveManifestNavigationInterceptionContextOptions = {
  basePath: string;
  currentMatchedPathname?: string | null;
  currentPathname: string;
  routeManifest: RouteManifest | null;
  targetPathname: string;
};
/**
 * Resolve the first-hop interception context from declared route topology.
 *
 * This is intentionally manifest-only: it lets a normal browser navigation
 * ask the server for an intercepted payload when the current URL is a declared
 * interception source for the target URL, without reintroducing snapshot
 * topology as route/layout/slot authority.
 *
 * When multiple manifest interceptions match, the first one wins. That order
 * is owned by the deterministic route graph builder.
 */
declare function resolveManifestNavigationInterceptionContext(options: ResolveManifestNavigationInterceptionContextOptions): string | null;
declare function resolveMiddlewareRewriteNavigationInterceptionContext(options: ResolveManifestNavigationInterceptionContextOptions): string | null;
//#endregion
export { resolveManifestNavigationInterceptionContext, resolveMiddlewareRewriteNavigationInterceptionContext };