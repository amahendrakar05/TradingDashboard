import { AppRoute } from "../routing/app-route-graph.js";
import { MetadataFileRoute } from "../server/metadata-routes.js";

//#region src/entries/app-rsc-manifest.d.ts
type AppRscManifestCode = {
  imports: string[];
  routeEntries: string[];
  metaRouteEntries: string[];
  generateStaticParamsEntries: string[];
  rootParamNameEntries: string[];
  rootNotFoundVar: string | null;
  rootForbiddenVar: string | null;
  rootUnauthorizedVar: string | null;
  rootLayoutVars: string[];
  globalErrorVar: string | null;
  /**
   * Path expression for the `app/global-not-found.{tsx,ts,js,jsx}` module
   * suitable for embedding in a generated `import()` call (already JSON-encoded
   * with platform path separators normalized). `null` when the user did not
   * define `global-not-found.tsx`.
   *
   * We intentionally do NOT register this module as a static `import * as`
   * in the manifest. Statically importing it puts global-not-found.tsx in
   * the same JS chunk as the root layout, which causes the CSS bundler to
   * concatenate their stylesheets into a single CSS file. The CSS minifier
   * (lightningcss) then drops overlapping declarations as dead code, so any
   * rule in global-not-found's CSS that the layout's CSS also defines gets
   * silently removed — breaking the cascade on route-miss 404s where only
   * global-not-found is supposed to render.
   *
   * By emitting a dynamic `import()` instead, the bundler gives
   * global-not-found.tsx its own chunk with its own CSS asset.
   *
   * @see Next.js test: test/e2e/app-dir/initial-css-order/initial-css-order.test.ts
   */
  globalNotFoundImportSpecifier: string | null;
};
type BuildAppRscManifestCodeOptions = {
  routes: AppRoute[];
  metadataRoutes?: MetadataFileRoute[];
  globalErrorPath?: string | null;
  /**
   * Optional `app/global-not-found.tsx` path. When present, route-miss 404s
   * render this module standalone (it provides its own <html>/<body>) instead
   * of wrapping the regular not-found boundary inside the root layout.
   * Mirrors Next.js 16's `experimental.globalNotFound` behavior.
   * @see https://github.com/vercel/next.js/blob/canary/packages/next/src/server/app-render/app-render.tsx
   */
  globalNotFoundPath?: string | null;
};
declare function buildAppRscManifestCode(options: BuildAppRscManifestCodeOptions): AppRscManifestCode;
//#endregion
export { buildAppRscManifestCode };