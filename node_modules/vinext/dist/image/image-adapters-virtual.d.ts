//#region src/image/image-adapters-virtual.d.ts
/**
 * Code generation for the `virtual:vinext-image-adapters` module, resolved by
 * the vinext vite plugin from the user's `images` config ({@link VinextImageConfig}).
 *
 * The generated module exports `registerConfiguredImageOptimizer(env)`, which the
 * server entries call on each request. It self-guards (the optimizer instantiates
 * once per isolate) and is a no-op when nothing is configured. Registration is
 * resilient: a factory that throws (e.g. a Cloudflare Images adapter on the
 * Node.js server, where the `IMAGES` binding can't exist) is logged and skipped
 * rather than failing every request, so the same config can be registered from
 * every runtime/router entry. When no optimizer is registered, image requests
 * fall back to serving the original asset unoptimized.
 *
 * Descriptor `options` are inlined into the generated module and forwarded to the
 * factory at runtime, so a config-time builder like `imagesOptimizer({ binding })`
 * never touches the Workers runtime — instantiation is deferred to the first
 * request.
 *
 * This mirrors the cache-adapter pattern in `cache/cache-adapters-virtual.ts`.
 */
/**
 * A serializable pointer to an image optimizer adapter module — the shape of the
 * `images.optimizer` slot in the vinext() plugin config. Produced by an adapter
 * builder (e.g. `imagesOptimizer(...)` from `@vinext/cloudflare/images/images-optimizer`)
 * or written by hand. `options` must be JSON-serializable: it is inlined into the
 * generated registration module and forwarded to the adapter factory at runtime.
 */
type ImageAdapterDescriptor<O extends Record<string, unknown> = Record<string, unknown>> = {
  /**
   * Module specifier (or absolute path, e.g. from `require.resolve(...)`) whose
   * default export is an image optimizer factory.
   */
  adapter: string; /** JSON-serializable options forwarded to the factory at runtime. */
  options?: O;
};
/**
 * The `images` option of the vinext() plugin: declaratively register the
 * server-side image optimizer (transform backend) instead of wiring `env.IMAGES`
 * into a custom worker entry.
 *
 * This is complementary to the `images` field in `next.config.js`, which
 * configures the standard Next.js image options (`remotePatterns`, `deviceSizes`,
 * `dangerouslyAllowSVG`, etc.). Those continue to be read from next.config; this
 * option only selects the runtime transform backend, which can't be expressed as
 * serializable next.config data.
 */
type VinextImageConfig = {
  /** Server-side image optimizer adapter (the `/_next/image` transform backend). */optimizer?: ImageAdapterDescriptor;
};
/** Public virtual module id imported by the server entries. */
declare const VIRTUAL_IMAGE_ADAPTERS = "virtual:vinext-image-adapters";
/**
 * Generate the source of the `virtual:vinext-image-adapters` module for the
 * given config. Always exports `registerConfiguredImageOptimizer(env)`.
 */
declare function generateImageAdaptersModule(images?: VinextImageConfig): string;
//#endregion
export { VIRTUAL_IMAGE_ADAPTERS, VinextImageConfig, generateImageAdaptersModule };