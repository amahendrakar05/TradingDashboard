//#region src/cache/cache-adapters-virtual.d.ts
/**
 * A serializable pointer to a cache adapter module — the shape of each `cache`
 * slot in the vinext() plugin config. Produced by an adapter builder (e.g.
 * `kvDataAdapter(...)` from `@vinext/cloudflare/cache/kv-data-adapter`) or written
 * by hand. `options` must be JSON-serializable: it is inlined into the generated
 * registration module and forwarded to the adapter factory at runtime.
 */
type CacheAdapterDescriptor<O extends Record<string, unknown> = Record<string, unknown>> = {
  /**
   * Module specifier (or absolute path, e.g. from `require.resolve(...)`) whose
   * default export is a cache adapter factory.
   */
  adapter: string; /** JSON-serializable options forwarded to the factory at runtime. */
  options?: O;
};
/**
 * The `cache` option of the vinext() plugin: declaratively register cache
 * handlers instead of calling `setDataCacheHandler()` / `setCdnCacheAdapter()`
 * from a worker entry.
 */
type VinextCacheConfig = {
  /** Page-level ISR serving strategy (CDN cache adapter). */cdn?: CacheAdapterDescriptor; /** Data cache (fetch / `"use cache"` / `unstable_cache`) handler. */
  data?: CacheAdapterDescriptor;
};
/** Public virtual module id imported by the server entries. */
declare const VIRTUAL_CACHE_ADAPTERS = "virtual:vinext-cache-adapters";
declare const VINEXT_CACHE_CONFIG_PLUGIN_PROPERTY = "__vinextCacheConfig";
type ViteConfigLoader = {
  loadConfigFromFile: typeof import("vite").loadConfigFromFile;
};
declare function findVinextCacheConfigInPlugins(plugins: import("vite").PluginOption[] | undefined): Promise<VinextCacheConfig | null>;
declare function loadVinextCacheConfigFromViteConfig(vite: ViteConfigLoader, root: string): Promise<VinextCacheConfig | null>;
/**
 * Generate the source of the `virtual:vinext-cache-adapters` module for the
 * given config. Always exports `registerConfiguredCacheAdapters(env)`.
 */
declare function generateCacheAdaptersModule(cache?: VinextCacheConfig): string;
//#endregion
export { VINEXT_CACHE_CONFIG_PLUGIN_PROPERTY, VIRTUAL_CACHE_ADAPTERS, VinextCacheConfig, findVinextCacheConfigInPlugins, generateCacheAdaptersModule, loadVinextCacheConfigFromViteConfig };