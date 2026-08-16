import { VINEXT_CACHE_CONFIG_PLUGIN_PROPERTY, VinextCacheConfig, findVinextCacheConfigInPlugins, loadVinextCacheConfigFromViteConfig } from "../cache/cache-adapters-virtual.js";
import { PluginOption } from "vite";

//#region src/config/prerender.d.ts
type VinextPrerenderConfig = true | {
  /**
   * Routes to pre-render after the production build.
   *
   * Currently only `"*"` is supported, which pre-renders every discovered
   * App Router and Pages Router route that vinext can statically render.
   */
  routes: "*";
};
type ResolvedVinextPrerenderConfig = {
  routes: "*";
};
type VinextPrerenderDecisionReason = "flag" | "next-export" | "vinext-config";
type VinextPrerenderDecision = ResolvedVinextPrerenderConfig & {
  reason: VinextPrerenderDecisionReason;
};
declare const VINEXT_PRERENDER_CONFIG_PLUGIN_PROPERTY = "__vinextPrerenderConfig";
declare const VINEXT_ROUTE_ROOT_CONFIG_PLUGIN_PROPERTY = "__vinextRouteRootConfig";
type VinextRouteRootConfig = {
  appDir?: string;
  disableAppRouter?: boolean;
  rscOutDir?: string;
  ssrOutDir?: string;
};
type ViteConfigLoader = {
  loadConfigFromFile: typeof import("vite").loadConfigFromFile;
};
declare function normalizeVinextPrerenderConfig(config: VinextPrerenderConfig | undefined): ResolvedVinextPrerenderConfig | null;
declare function findVinextPrerenderConfigInPlugins(plugins: PluginOption[] | undefined): Promise<ResolvedVinextPrerenderConfig | null>;
declare function findVinextRouteRootConfigInPlugins(plugins: PluginOption[] | undefined): Promise<VinextRouteRootConfig | null>;
declare function loadVinextPrerenderConfigFromViteConfig(vite: ViteConfigLoader, root: string): Promise<ResolvedVinextPrerenderConfig | null>;
declare function loadVinextRouteRootConfigFromViteConfig(vite: ViteConfigLoader, root: string): Promise<VinextRouteRootConfig | null>;
declare function resolveVinextPrerenderDecision(options: {
  prerenderAllFlag?: boolean;
  vinextPrerenderConfig?: ResolvedVinextPrerenderConfig | null;
  nextOutput?: string;
}): VinextPrerenderDecision | null;
declare function formatVinextPrerenderLabel(decision: VinextPrerenderDecision): string;
//#endregion
export { ResolvedVinextPrerenderConfig, VINEXT_CACHE_CONFIG_PLUGIN_PROPERTY, VINEXT_PRERENDER_CONFIG_PLUGIN_PROPERTY, VINEXT_ROUTE_ROOT_CONFIG_PLUGIN_PROPERTY, type VinextCacheConfig, VinextPrerenderConfig, VinextPrerenderDecision, VinextPrerenderDecisionReason, VinextRouteRootConfig, findVinextCacheConfigInPlugins, findVinextPrerenderConfigInPlugins, findVinextRouteRootConfigInPlugins, formatVinextPrerenderLabel, loadVinextCacheConfigFromViteConfig, loadVinextPrerenderConfigFromViteConfig, loadVinextRouteRootConfigFromViteConfig, normalizeVinextPrerenderConfig, resolveVinextPrerenderDecision };