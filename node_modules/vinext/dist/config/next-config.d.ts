import { PHASE_PRODUCTION_BUILD } from "../shims/constants.js";
import { PluginOption } from "vite";

//#region src/config/next-config.d.ts
declare const VINEXT_NEXT_CONFIG_PLUGIN_PROPERTY = "__vinextNextConfig";
/**
 * Parse a body size limit value (string or number) into bytes.
 * Accepts Next.js-style strings like "1mb", "500kb", "10mb", bare number strings like "1048576" (bytes),
 * and numeric values. Supports b, kb, mb, gb, tb, pb units.
 * Returns the default 1MB if the value is not provided or invalid.
 * Throws if the parsed value is less than 1.
 */
declare function parseBodySizeLimit(value: string | number | undefined | null): number;
type HasCondition = {
  type: "header" | "cookie" | "query" | "host";
  key: string;
  value?: string;
};
type NextRedirect = {
  source: string;
  destination: string;
  permanent: boolean;
  has?: HasCondition[];
  missing?: HasCondition[];
  /**
   * When true (the default with i18n configured), Next.js prepends an internal
   * locale alternation to the source so the rule matches locale-prefixed paths.
   * When `false`, the source is left untouched and matches the raw path,
   * letting user-supplied `:locale` segments capture the prefix themselves.
   * See https://nextjs.org/docs/app/api-reference/config/next-config-js/redirects#locale
   */
  locale?: false;
  /**
   * When `false`, the rule is NOT prefixed with `basePath`. Source and
   * destination are matched/applied verbatim. Mirrors Next.js's
   * `Redirect.basePath: false` opt-out — see
   * `.nextjs-ref/packages/next/src/lib/load-custom-routes.ts:26`.
   */
  basePath?: false;
};
type NextRewrite = {
  source: string;
  destination: string;
  has?: HasCondition[];
  missing?: HasCondition[]; /** See {@link NextRedirect.locale}. */
  locale?: false; /** See {@link NextRedirect.basePath}. */
  basePath?: false;
};
type NextHeader = {
  source: string;
  has?: HasCondition[];
  missing?: HasCondition[];
  headers: Array<{
    key: string;
    value: string;
  }>; /** See {@link NextRedirect.basePath}. */
  basePath?: false; /** See {@link NextRedirect.locale}. */
  locale?: false;
};
type NextI18nConfig = {
  /** List of supported locales */locales: string[]; /** The default locale (used when no locale prefix is in the URL) */
  defaultLocale: string;
  /**
   * Whether to auto-detect locale from Accept-Language header.
   * Defaults to true in Next.js.
   */
  localeDetection?: boolean;
  /**
   * Domain-based routing. Each domain maps to a specific locale.
   */
  domains?: Array<{
    domain: string;
    defaultLocale: string;
    locales?: string[];
    http?: true;
  }>;
};
/**
 * MDX compilation options extracted from @next/mdx config.
 * These are passed through to @mdx-js/rollup so that custom
 * remark/rehype/recma plugins configured in next.config work with Vite.
 */
type MdxOptions = {
  remarkPlugins?: unknown[];
  rehypePlugins?: unknown[];
  recmaPlugins?: unknown[];
};
type PrefetchInliningConfig = false | {
  maxBundleSize: number;
  maxSize: number;
};
type NextConfig = {
  /** Additional env variables */env?: Record<string, string>; /** Base URL path prefix */
  basePath?: string;
  /**
   * Prefix applied to every emitted JS/CSS/image/static asset URL.
   * Accepts a path prefix (e.g. `/custom-asset-prefix`) or an absolute
   * URL (e.g. `https://cdn.example.com`). Distinct from `basePath`:
   * `basePath` affects route URLs; `assetPrefix` only affects asset URLs.
   * @see https://nextjs.org/docs/app/api-reference/config/next-config-js/assetPrefix
   */
  assetPrefix?: string; /** Whether to add trailing slashes */
  trailingSlash?: boolean; /** Internationalization routing config */
  i18n?: NextI18nConfig; /** URL redirect rules */
  redirects?: () => Promise<NextRedirect[]> | NextRedirect[]; /** URL rewrite rules */
  rewrites?: () => Promise<NextRewrite[] | {
    beforeFiles: NextRewrite[];
    afterFiles: NextRewrite[];
    fallback: NextRewrite[];
  }> | NextRewrite[] | {
    beforeFiles: NextRewrite[];
    afterFiles: NextRewrite[];
    fallback: NextRewrite[];
  }; /** Custom response headers */
  headers?: () => Promise<NextHeader[]> | NextHeader[]; /** Image optimization config */
  images?: {
    remotePatterns?: Array<URL | {
      protocol?: string;
      hostname: string;
      port?: string;
      pathname?: string;
      search?: string;
    }>;
    domains?: string[];
    unoptimized?: boolean; /** Allowed device widths for image optimization. Defaults to Next.js defaults: [640, 750, 828, 1080, 1200, 1920, 2048, 3840] */
    deviceSizes?: number[]; /** Allowed image sizes for fixed-width images. Defaults to Next.js defaults: [16, 32, 48, 64, 96, 128, 256, 384] */
    imageSizes?: number[]; /** Allowed image qualities. When unset, any quality from 1-100 is permitted (matches Next.js). */
    qualities?: number[]; /** Allow SVG images through the image optimization endpoint. SVG can contain scripts, so only enable if you trust all image sources. */
    dangerouslyAllowSVG?: boolean; /** Allow image optimization for hostnames that resolve to private IP addresses. This is a security risk (SSRF) — only enable for private networks when you understand the risk. */
    dangerouslyAllowLocalIP?: boolean; /** Content-Disposition header for image responses. Defaults to "inline". */
    contentDispositionType?: "inline" | "attachment"; /** Content-Security-Policy header for image responses. Defaults to "script-src 'none'; frame-src 'none'; sandbox;" */
    contentSecurityPolicy?: string;
  };
  /**
   * Enable React Strict Mode. When `true`, the client root is wrapped in
   * `<React.StrictMode>` so React runs its dev-only strict checks (double-
   * invoked effects/render, deprecation warnings). `null`/unset resolves per
   * router: OFF for the Pages Router, ON for the App Router — matching Next.js.
   * @see https://nextjs.org/docs/app/api-reference/config/next-config-js/reactStrictMode
   */
  reactStrictMode?: boolean | null; /** Build output mode: 'export' for full static export, 'standalone' for single server */
  output?: "export" | "standalone"; /** File extensions treated as routable pages/routes (Next.js pageExtensions) */
  pageExtensions?: string[]; /** Turbopack-compatible module resolution options. */
  turbopack?: {
    resolveAlias?: Record<string, unknown>;
    resolveExtensions?: string[];
    [key: string]: unknown;
  };
  /**
   * Module specifiers that are required for side effects on the client before
   * hydration, in array order, ahead of the user's `instrumentation-client.{ts,js}`.
   * Each entry may be a bare npm package name or a path relative to the project root.
   */
  instrumentationClientInject?: string[]; /** Extra origins allowed to access the dev server. */
  allowedDevOrigins?: string[]; /** Maximum age in seconds for stale ISR entries before blocking regeneration. */
  expireTime?: number;
  /**
   * Maximum total length (in characters) of the preload `Link` header emitted
   * during App Router SSR. React drops whole entries once the limit is
   * exceeded; `0` disables emission entirely. Defaults to 6000.
   * @see https://nextjs.org/docs/app/api-reference/config/next-config-js/reactMaxHeadersLength
   */
  reactMaxHeadersLength?: number; /** User agents that require blocking metadata in the initial head. */
  htmlLimitedBots?: RegExp | string;
  /**
   * Enable Cache Components (Next.js 16).
   * When true, enables the "use cache" directive for pages, components, and functions.
   * Replaces the removed experimental.ppr and experimental.dynamicIO flags.
   */
  cacheComponents?: boolean;
  /**
   * Enables source maps while generating static pages.
   * Helps with errors during the prerender phase in `vinext build`.
   * Defaults to `true`. Set to `false` to disable.
   */
  enablePrerenderSourceMaps?: boolean; /** Transpile packages (Vite handles this natively) */
  transpilePackages?: string[];
  /**
   * Packages that should be treated as server-external (not bundled by Vite).
   * Corresponds to Next.js `serverExternalPackages` (or the legacy
   * `experimental.serverComponentsExternalPackages`).
   */
  serverExternalPackages?: string[]; /** Webpack config (ignored — we use Vite) */
  webpack?: unknown;
  /**
   * Compiler options for build-time code transforms.
   * vinext supports the subset that maps to Vite-compatible transforms.
   */
  compiler?: {
    /** Remove `console.*` calls from the client bundle. */removeConsole?: boolean | {
      exclude?: string[];
    };
    /**
     * Inline compile-time constants in both client and server bundles.
     * Mirrors Next.js `compiler.define`.
     * @see https://nextjs.org/docs/app/api-reference/config/next-config-js/compiler#define
     */
    define?: Record<string, string | number | boolean>;
    /**
     * Inline compile-time constants in server bundles only (not client).
     * Mirrors Next.js `compiler.defineServer`.
     */
    defineServer?: Record<string, string | number | boolean>;
  };
  experimental?: {
    /** Enables hard-navigation recovery when App Router navigation rendering fails. */appNavFailHandling?: boolean;
    /**
     * Enables the experimental App Router gesture transition API:
     * `useRouter().experimental_gesturePush()`.
     */
    gestureTransition?: boolean;
    /**
     * Enables App Router Segment Cache prefetch inlining. When provided as an
     * object, thresholds are resolved with Next.js defaults and non-finite
     * values are clamped to Number.MAX_SAFE_INTEGER.
     */
    prefetchInlining?: boolean | {
      maxBundleSize?: number;
      maxSize?: number;
    };
    [key: string]: unknown;
  };
  /**
   * Path to a custom cache handler module (e.g., KV, Redis, DynamoDB).
   * Accepts relative paths, absolute paths, or file:// URLs from import.meta.resolve().
   * When "type": "module" is set in package.json, use import.meta.resolve() instead of
   * require.resolve() to get a valid path.
   */
  cacheHandler?: string;
  /**
   * Maximum memory size (bytes) for the default in-memory cache handler.
   * Set to 0 to disable in-memory caching entirely.
   */
  cacheMaxMemorySize?: number;
  /**
   * Custom build ID generator. If provided, called once at build/dev start.
   * Must return a non-empty string, or null to use the default random ID.
   */
  generateBuildId?: () => string | null | Promise<string | null>; /** Identifier for deployment-aware cache keys and version skew protection. */
  deploymentId?: string; /** Any other options */
  [key: string]: unknown;
};
type NextConfigFactory = (phase: string, opts: {
  defaultConfig: NextConfig;
}) => NextConfig | Promise<NextConfig>;
type NextConfigInput = NextConfig | NextConfigFactory;
declare function findVinextNextConfigInPlugins(plugins: PluginOption[] | undefined): Promise<NextConfigInput | null>;
/**
 * Resolved configuration with all async values awaited.
 */
type ResolvedNextConfig = {
  env: Record<string, string>;
  basePath: string;
  /**
   * Resolved `assetPrefix` from next.config.
   *
   * Empty string when unset. Trailing slashes are trimmed. May be either:
   *  - a path prefix beginning with `/` (e.g. `"/custom-asset-prefix"`), or
   *  - an absolute URL with `http(s)://` origin (e.g. `"https://cdn.example.com"`
   *    or `"https://cdn.example.com/sub"`).
   *
   * Mirrors Next.js semantics — `assetPrefix` controls emitted asset URLs
   * only; route URLs continue to live under `basePath`.
   *
   * @see https://nextjs.org/docs/app/api-reference/config/next-config-js/assetPrefix
   */
  assetPrefix: string;
  trailingSlash: boolean;
  output: "" | "export" | "standalone";
  pageExtensions: string[];
  resolveExtensions: string[] | null;
  serverResolveExtensions: string[] | null;
  instrumentationClientInject: string[];
  cacheComponents: boolean;
  appNavFailHandling: boolean;
  /**
   * Enables the experimental App Router gesture transition API:
   * `useRouter().experimental_gesturePush()`.
   */
  gestureTransition: boolean;
  /**
   * Resolved `experimental.prefetchInlining` config. Next.js normalizes `true`
   * and partial object config into concrete thresholds.
   */
  prefetchInlining: PrefetchInliningConfig;
  redirects: NextRedirect[];
  rewrites: {
    beforeFiles: NextRewrite[];
    afterFiles: NextRewrite[];
    fallback: NextRewrite[];
  };
  headers: NextHeader[];
  images: NextConfig["images"];
  i18n: NextI18nConfig | null; /** MDX remark/rehype/recma plugins extracted from @next/mdx config */
  mdx: MdxOptions | null; /** Explicit module aliases preserved from wrapped next.config plugins. */
  aliases: Record<string, string>; /** Extra allowed origins for dev server access (from allowedDevOrigins). */
  allowedDevOrigins: string[]; /** Extra allowed origins for server action CSRF validation (from experimental.serverActions.allowedOrigins). */
  serverActionsAllowedOrigins: string[]; /** Packages whose barrel imports should be optimized (from experimental.optimizePackageImports). */
  optimizePackageImports: string[]; /** Packages explicitly requested for server/client transpilation. */
  transpilePackages: string[]; /** Packages treated as application code by Turbopack's foreign-code condition. */
  turbopackTranspilePackages: string[]; /** Inline app CSS into production HTML (from experimental.inlineCss). */
  inlineCss: boolean; /** Enable standalone route-miss 404 handling (from experimental.globalNotFound). */
  globalNotFound: boolean; /** Parsed body size limit for server actions in bytes (from experimental.serverActions.bodySizeLimit). Defaults to 1MB. */
  serverActionsBodySizeLimit: number; /** Verbatim body size limit config value (e.g. "2mb") for the "Body exceeded {limit} limit" error. Defaults to "1 MB". */
  serverActionsBodySizeLimitLabel: string; /** Route-level expire fallback in seconds for ISR entries with numeric revalidate. */
  expireTime: number;
  /**
   * Maximum total length (in characters) of the preload `Link` header emitted
   * during App Router SSR. `0` disables emission. Defaults to 6000.
   */
  reactMaxHeadersLength: number; /** Serialized htmlLimitedBots regexp source from next.config. */
  htmlLimitedBots: string | undefined;
  /**
   * Packages that should be treated as server-external (not bundled by Vite).
   * Sourced from `serverExternalPackages` or the legacy
   * `experimental.serverComponentsExternalPackages` in next.config.
   */
  serverExternalPackages: string[]; /** Enable sourcemaps for prerender error stack traces. Defaults to true. */
  enablePrerenderSourceMaps: boolean;
  /**
   * Enable App Shell prefetching (from experimental.appShells).
   * Plumbing-only in vinext — the flag is accepted and forwarded to the client
   * bundle via `process.env.__NEXT_APP_SHELLS`, but actual App Shell behavior
   * requires the segment-cache architecture which is not yet implemented.
   */
  appShells: boolean; /** Resolved build ID (from generateBuildId, or a random UUID if not provided). */
  buildId: string; /** Resolved deployment ID from next.config.js or NEXT_DEPLOYMENT_ID. */
  deploymentId: string | undefined;
  /**
   * Path to a custom cache handler module. file:// URLs are resolved to
   * filesystem paths via fileURLToPath() during config resolution.
   */
  cacheHandler: string | undefined;
  /**
   * Maximum memory size (bytes) for the default in-memory cache handler.
   * Set to 0 to disable in-memory caching entirely.
   */
  cacheMaxMemorySize: number | undefined;
  /**
   * Concatenated hash salt from `experimental.outputHashSalt` config option
   * and `NEXT_HASH_SALT` environment variable. Empty string when neither is set.
   * When non-empty, mix into content-addressed output filenames so hash values
   * change without modifying source — useful for cache-busting after CDN poisoning.
   */
  hashSalt: string;
  /**
   * Raw `sassOptions` object from next.config (or `null` when unset). vinext
   * passes the relevant keys through to Vite's `css.preprocessorOptions.scss`
   * so SCSS variables defined via `additionalData` / `prependData`, partials
   * resolved via `includePaths` / `loadPaths`, and a custom `implementation`
   * all behave the same as in Next.js.
   *
   * Kept loose (`Record<string, unknown> | null`) to match Next.js's typing —
   * the object is forwarded to Sass and may contain any modern Sass option.
   */
  sassOptions: Record<string, unknown> | null;
  /**
   * When enabled, strip `console.*` calls from the client bundle.
   * Mirrors Next.js `compiler.removeConsole` option.
   * `true` strips all console calls; `{ exclude: ["error"] }` strips all
   * except the specified method names (case-insensitive).
   */
  removeConsole: boolean | {
    exclude: string[];
  };
  /**
   * Mirrors Next.js `experimental.disableOptimizedLoading`. When `false`
   * (the default), Pages Router page scripts are emitted with `defer` in
   * `<head>` so the browser can prefetch them in parallel with HTML parsing.
   * When `true`, scripts are emitted without `defer` (legacy behaviour).
   *
   * See `.nextjs-ref/packages/next/src/pages/_document.tsx` (`getScripts` →
   * `defer={!disableOptimizedLoading}`) and the upstream
   * `test/e2e/optimized-loading` test fixture.
   */
  disableOptimizedLoading: boolean;
  /**
   * Resolved `reactStrictMode` from next.config, preserved as `boolean | null`
   * so each router can apply its own default (Next.js resolves `null` to OFF
   * for the Pages Router and ON for the App Router). When the effective value
   * is `true`, the client root is wrapped in `<React.StrictMode>`.
   *
   * See `.nextjs-ref/packages/next/src/build/define-env.ts`
   * (`__NEXT_STRICT_MODE` / `__NEXT_STRICT_MODE_APP`).
   */
  reactStrictMode: boolean | null;
  /**
   * Mirrors Next.js `experimental.scrollRestoration`. When true, the Pages
   * Router client takes ownership of browser history scroll restoration by
   * setting `window.history.scrollRestoration = "manual"` and snapshotting
   * scroll positions per history entry.
   */
  scrollRestoration: boolean;
  /**
   * Build-time constant replacement map applied to BOTH client and server
   * bundles. Sourced from `compiler.define` in next.config. Values are
   * pre-serialized via `JSON.stringify` so they can be fed straight into
   * Vite's `define` config (which expects strings of source code).
   *
   * Mirrors Next.js — strings, numbers, and booleans are accepted; other
   * value shapes are dropped.
   * @see https://nextjs.org/docs/app/api-reference/config/next-config-js/compiler#define
   */
  compilerDefine: Record<string, string>;
  /**
   * Build-time constant replacement map applied to SERVER bundles only
   * (RSC + SSR + middleware). Sourced from `compiler.defineServer` in
   * next.config. Same serialization rules as `compilerDefine`. Client
   * bundles intentionally never see these substitutions, so referencing
   * a `defineServer` identifier from the browser stays as the raw
   * identifier (typically resolving to `undefined`).
   */
  compilerDefineServer: Record<string, string>;
  /**
   * Allow-list of keys, sourced from `experimental.clientTraceMetadata`,
   * to forward from the active OpenTelemetry context into the SSR HTML head
   * as `<meta>` tags. `undefined` (or empty) disables injection.
   *
   * Mirrors Next.js: packages/next/src/server/lib/trace/utils.ts (getTracedMetadata).
   */
  clientTraceMetadata: string[] | undefined;
  /**
   * App Router client cache freshness windows in seconds, sourced from
   * `experimental.staleTimes`. Controls how long prefetched route segments
   * are considered fresh in the client-side router cache.
   *
   * `dynamic` applies to partial/dynamic prefetches (default 0 — no reuse).
   * `static` applies to full-route prefetches (default 300 — 5 minutes).
   * Mirrors Next.js' `process.env.__NEXT_CLIENT_ROUTER_{DYNAMIC,STATIC}_STALETIME`.
   */
  staleTimes: {
    dynamic: number;
    static: number;
  };
  /**
   * Mirrors Next.js `experimental.useLightningcss`. When `true`, switch
   * Vite's CSS pipeline from PostCSS to lightningcss for both transforms
   * and minification, so the user's `lightningCssFeatures` config takes
   * effect (without this flag set, Next.js's own
   * `lightningCssFeatures` option is also a no-op).
   *
   * @see https://nextjs.org/docs/app/api-reference/config/next-config-js/useLightningcss
   */
  useLightningcss: boolean;
  /**
   * Resolved `experimental.lightningCssFeatures` from next.config, converted
   * from dash-case feature names into the numeric bitmask form expected by
   * the lightningcss `transform()` API (`include` / `exclude` options). When
   * the user did not supply the option, both masks are `0` (a no-op).
   *
   * @see https://nextjs.org/docs/app/api-reference/config/next-config-js/lightningCssFeatures
   */
  lightningCssFeatures: {
    include: number;
    exclude: number;
  };
};
/**
 * Whole-word substring check for any of the CJS-style globals that the
 * injector plugin would shim. Used to skip the transform entirely for the
 * common case where the config is pure ESM (no `__filename`, `__dirname`,
 * `require`, `module`, or `exports` references).
 *
 * False positives are harmless: a comment, string literal, or unrelated
 * identifier like `node:module` will trigger the transform unnecessarily,
 * but the resulting injection is idempotent and the loaded config is
 * unaffected. False negatives would be a correctness bug, so we err on the
 * side of matching too eagerly.
 *
 * Note: `\bexports\b` does not match `export default` (different word
 * boundaries), and `\brequire\b` does not match `requireSomething`.
 */
declare function referencesCjsGlobals(source: string): boolean;
/**
 * Static heuristic: returns true when the source appears to assign to
 * `module.exports` — either via `module.exports = …`, `module.exports.foo = …`,
 * or `module.exports[…] = …`. Used to decide whether the injector plugin
 * needs to wire up the wrapper `module` object so {@link unwrapConfig} can
 * read back the user's CJS-style export.
 *
 * Pure-ESM configs skip the wrapper entirely, which means a faster transform
 * (no extra `export const` line) and a simpler unwrap path (no need to
 * disambiguate "initial empty object" from "user reassigned to {}").
 *
 * Like {@link referencesCjsGlobals}, false positives are harmless: at worst
 * we emit an unused `__vinext_cjs_exports` named export, and `unwrapConfig`
 * still prefers it (it points at an empty object, which then gets treated
 * as the config — equivalent to today's sentinel logic for pure-ESM files
 * that happen to mention `module.exports` only in a string).
 */
declare function reassignsModuleExports(source: string): boolean;
declare function findNextConfigPath(root: string): string | null;
declare function resolveNextConfigInput(config: NextConfigInput, phase?: string): Promise<NextConfig>;
/**
 * Find and load the next.config file from the project root.
 * Returns null if no config file is found.
 *
 * Attempts Vite's module runner first so TS configs and extensionless local
 * imports (e.g. `import "./env"`) resolve consistently. If loading fails due
 * to CJS constructs (`require`, `module.exports`), falls back to `createRequire`
 * so common CJS plugin wrappers (nextra, @next/mdx, etc.) still work, including
 * `next.config.js` files written in CJS syntax inside a `"type": "module"`
 * package (the common shape after `vinext init`).
 */
declare function loadNextConfig(root: string, phase?: string): Promise<NextConfig | null>;
/**
 * Normalize the `assetPrefix` option from next.config.
 *
 * Accepts both absolute URLs (`https://cdn.example.com[/subpath]`) and
 * path prefixes (`/custom-asset-prefix`). Trailing slashes are trimmed.
 * Empty/whitespace-only strings are treated as unset and return `""`.
 *
 * Path prefixes that omit the leading slash get one added so they always
 * begin with `/` — this matches how Next.js routes match against them.
 *
 * Non-string values are rejected to surface config mistakes early.
 *
 * @see https://nextjs.org/docs/app/api-reference/config/next-config-js/assetPrefix
 */
declare function normalizeAssetPrefix(value: unknown): string;
/**
 * Resolve the App Router RSC compatibility identity for a build.
 *
 * This token is baked into the client bundle and echoed by the server in the
 * `X-Vinext-RSC-Compatibility-Id` response header; browser navigation rejects
 * RSC payloads whose token differs (deploy skew) without exposing the raw
 * build ID. When the user pins a `deploymentId` we reuse it (already stable
 * across plugin instances); otherwise we mint a random UUID.
 *
 * NOTE: like `resolveBuildId`, this is non-deterministic in the no-deploymentId
 * case, so a single `vinext build` that instantiates the plugin more than once
 * (App Router `buildApp()` + the hybrid Pages Router `vite.build()`) must
 * resolve it once and share it — see `__VINEXT_SHARED_RSC_COMPATIBILITY_ID`.
 */
declare function createRscCompatibilityId(nextConfig: Pick<ResolvedNextConfig, "deploymentId">): string;
declare function lightningCssFeatureNamesToMask(names: readonly string[]): number;
/**
 * Resolve a NextConfig into a fully-resolved ResolvedNextConfig.
 * Awaits async functions for redirects/rewrites/headers.
 */
declare function resolveNextConfig(config: NextConfig | null, root?: string, options?: {
  dev?: boolean;
}): Promise<ResolvedNextConfig>;
/**
 * Extract MDX compilation options (remark/rehype/recma plugins) from
 * a Next.js config that uses @next/mdx.
 *
 * @next/mdx wraps the config with a webpack function that injects an MDX
 * loader rule. The remark/rehype plugins are captured in that closure.
 * We probe the webpack function with a mock config to extract them.
 */
declare function extractMdxOptions(config: NextConfig, root?: string): Promise<MdxOptions | null>;
/**
 * Detect next-intl in the project and auto-register the `next-intl/config`
 * alias if needed.
 *
 * next-intl's `createNextIntlPlugin()` crashes in vinext because it calls
 * `require('next/package.json')` to check the Next.js version. Instead,
 * vinext detects next-intl and registers the alias automatically.
 *
 * Note: `require.resolve('next-intl')` walks up to parent `node_modules`
 * directories via standard Node module resolution. In a monorepo, next-intl
 * installed at the workspace root will trigger detection even if not listed
 * in the project's own package.json. This is acceptable since a workspace-root
 * install implies the user wants it available.
 *
 * Mutates `resolved.aliases` and `resolved.env` in place.
 */
declare function detectNextIntlConfig(root: string, resolved: ResolvedNextConfig): void;
//#endregion
export { HasCondition, MdxOptions, NextConfig, NextConfigInput, NextHeader, NextI18nConfig, NextRedirect, NextRewrite, PHASE_PRODUCTION_BUILD, PrefetchInliningConfig, ResolvedNextConfig, VINEXT_NEXT_CONFIG_PLUGIN_PROPERTY, createRscCompatibilityId, detectNextIntlConfig, extractMdxOptions, findNextConfigPath, findVinextNextConfigInPlugins, lightningCssFeatureNamesToMask, loadNextConfig, normalizeAssetPrefix, parseBodySizeLimit, reassignsModuleExports, referencesCjsGlobals, resolveNextConfig, resolveNextConfigInput };