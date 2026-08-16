import { NextHeader, NextI18nConfig, NextRedirect, NextRewrite, PrefetchInliningConfig } from "../config/next-config.js";
import { AppRoute } from "../routing/app-route-graph.js";
import { MetadataFileRoute } from "../server/metadata-routes.js";
import { ImageConfig } from "../server/image-optimization.js";

//#region src/entries/app-rsc-entry.d.ts
/**
 * Resolved config options relevant to App Router request handling.
 * Passed from the Vite plugin where the full next.config.js is loaded.
 */
type AppRouterConfig = {
  redirects?: NextRedirect[];
  rewrites?: {
    beforeFiles: NextRewrite[];
    afterFiles: NextRewrite[];
    fallback: NextRewrite[];
  };
  headers?: NextHeader[]; /** Extra origins allowed for server action CSRF checks (from experimental.serverActions.allowedOrigins). */
  allowedOrigins?: string[]; /** Extra origins allowed for dev server access (from allowedDevOrigins). */
  allowedDevOrigins?: string[]; /** Body size limit for server actions in bytes (from experimental.serverActions.bodySizeLimit). */
  bodySizeLimit?: number; /** Verbatim body size limit config value (e.g. "2mb") for the "Body exceeded {limit} limit" error. */
  bodySizeLimitLabel?: string; /** Serialized next.config htmlLimitedBots regexp source. */
  htmlLimitedBots?: string;
  /**
   * Allow-list of keys (from `experimental.clientTraceMetadata`) to surface
   * from the active OpenTelemetry context as `<meta>` tags in the SSR head.
   * Undefined or empty disables emission entirely.
   */
  clientTraceMetadata?: string[] | undefined;
  /**
   * Resolved `assetPrefix` from next.config. Empty string when unset.
   * Embedded in the generated entry so the App Router prod-server reads
   * it from the imported module instead of a sidecar JSON file —
   * matches how the Pages Router entry exposes `vinextConfig.assetPrefix`.
   *
   * @see https://nextjs.org/docs/app/api-reference/config/next-config-js/assetPrefix
   */
  assetPrefix?: string; /** Route-level expire fallback in seconds for ISR entries with numeric revalidate. */
  expireTime?: number;
  /**
   * Maximum total length (in characters) of the preload `Link` header emitted
   * during App Router SSR. `0` disables emission. Defaults to 6000.
   */
  reactMaxHeadersLength?: number; /** Maximum in-memory cache size in bytes. 0 disables the default memory cache. */
  cacheMaxMemorySize?: number; /** Inline app CSS into production HTML (from experimental.inlineCss). */
  inlineCss?: boolean; /** Enable standalone route-miss 404 handling (from experimental.globalNotFound). */
  globalNotFound?: boolean; /** Enables Next.js Cache Components semantics for App Router document HTML. */
  cacheComponents?: boolean; /** Resolved `experimental.prefetchInlining` thresholds. */
  prefetchInlining?: PrefetchInliningConfig; /** Whether the RSC build discovered any server references. Defaults to true. */
  hasServerActions?: boolean; /** Internationalization routing config for middleware matcher locale handling. */
  i18n?: NextI18nConfig | null;
  imageConfig?: ImageConfig;
  /**
   * Absolute path to `app/global-not-found.{tsx,ts,js,jsx}` when present.
   * When provided, route-miss 404s render this module standalone (it owns its
   * own `<html>` and `<body>`) instead of wrapping the regular `not-found.tsx`
   * boundary inside the root layout. Mirrors Next.js 16's
   * `experimental.globalNotFound` behavior.
   * @see https://github.com/vercel/next.js/blob/canary/test/e2e/app-dir/global-not-found
   */
  globalNotFoundPath?: string | null;
  /**
   * When true, the project has a `pages/` directory alongside the App Router.
   * The generated RSC entry exposes `/__vinext/prerender/pages-static-paths`
   * so `prerenderPages` can call `getStaticPaths` via `wrangler unstable_startWorker`
   * in CF Workers builds. `pageRoutes` is loaded from the SSR environment via
   * `import("./ssr/index.js")`, which re-exports it from
   * `virtual:vinext-server-entry` when this flag is set.
   */
  hasPagesDir?: boolean; /** Exact public/ file routes, using normalized leading-slash pathnames. */
  publicFiles?: string[]; /** Server-only token used to validate the draft-mode bypass cookie. */
  draftModeSecret?: string;
};
/**
 * Generate the virtual RSC entry module.
 *
 * This runs in the `rsc` Vite environment (react-server condition).
 * It matches the incoming request URL to an app route, builds the
 * nested layout + page tree, and renders it to an RSC stream.
 */
declare function generateRscEntry(appDir: string, routes: AppRoute[], middlewarePath?: string | null, metadataRoutes?: MetadataFileRoute[], globalErrorPath?: string | null, basePath?: string, trailingSlash?: boolean, config?: AppRouterConfig, instrumentationPath?: string | null): string;
//#endregion
export { generateRscEntry };