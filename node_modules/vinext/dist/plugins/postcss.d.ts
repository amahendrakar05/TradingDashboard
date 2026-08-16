//#region src/plugins/postcss.d.ts
/**
 * Module-level cache for resolvePostcssStringPlugins — avoids re-scanning per Vite environment.
 * Stores the Promise itself so concurrent calls (RSC/SSR/Client config() hooks firing in
 * parallel) all await the same in-flight scan rather than each starting their own.
 */
declare const postcssCache: Map<string, Promise<{
  plugins: unknown[];
} | undefined>>;
/**
 * Resolve PostCSS string plugin names in a project's PostCSS config.
 *
 * Next.js (via postcss-load-config) resolves string plugin names in the
 * object form `{ plugins: { "pkg-name": opts } }` but NOT in the array form
 * `{ plugins: ["pkg-name"] }`. Since many Next.js projects use the array
 * form (particularly with Tailwind CSS v4), we detect this case and resolve
 * the string names to actual plugin functions so Vite can use them.
 *
 * Returns the resolved PostCSS config object to inject into Vite's
 * `css.postcss`, or `undefined` if no resolution is needed.
 */
declare function resolvePostcssStringPlugins(projectRoot: string): Promise<{
  plugins: unknown[];
} | undefined>;
//#endregion
export { postcssCache, resolvePostcssStringPlugins };