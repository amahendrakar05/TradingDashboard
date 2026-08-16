//#region src/routing/file-matcher.d.ts
declare function normalizePageExtensions(pageExtensions?: readonly string[] | null): string[];
type ValidFileMatcher = {
  extensions: string[];
  dottedExtensions: string[];
  extensionRegex: RegExp;
  isPageFile(filePath: string): boolean;
  isAppRouterPage(filePath: string): boolean;
  isAppRouterRoute(filePath: string): boolean;
  isAppLayoutFile(filePath: string): boolean;
  isAppDefaultFile(filePath: string): boolean;
  stripExtension(filePath: string): string;
};
/**
 * Ported in spirit from Next.js createValidFileMatcher:
 * packages/next/src/server/lib/find-page-file.ts
 */
declare function createValidFileMatcher(pageExtensions?: readonly string[] | null): ValidFileMatcher;
/** Check if a file exists with any configured page extension. */
declare function findFileWithExtensions(basePath: string, matcher: ValidFileMatcher): boolean;
/**
 * Find a file by basename and configured page extension in a directory.
 * Returns the first matching absolute path, or null if not found.
 */
declare function findFileWithExts(dir: string, name: string, matcher: ValidFileMatcher): string | null;
/**
 * Add the config extensions produced by `vinext init` to vinext's resolver.
 *
 * `pageExtensions` is intentionally not part of module resolution. Next.js
 * uses it to discover route files; custom module extensions are configured
 * separately through `turbopack.resolveExtensions` or webpack
 * `resolve.extensions`.
 *
 * The default order preserves vinext's existing module-resolution behavior
 * and matches Next.js Turbopack for overlapping JavaScript and TypeScript
 * extensions.
 *
 * `.cjs`/`.cts` go last because `vinext init` renames CJS config files when it
 * adds `"type": "module"`, and app code may import those files extensionlessly.
 */
declare function buildViteResolveExtensions(viteExtensions?: readonly string[]): string[];
/**
 * Normalize an explicit Next.js resolver extension list for Vite.
 *
 * Unlike `pageExtensions`, both Turbopack's `resolveExtensions` and webpack's
 * `resolve.extensions` replace their resolver defaults. The empty string is a
 * webpack/Turbopack convention for trying the import exactly as written; Vite
 * already does that before appending extensions, so it must be omitted here.
 */
declare function normalizeViteResolveExtensions(extensions: readonly string[]): string[];
/**
 * Use function-form exclude for Node < 22.14 compatibility.
 *
 * Yields forward-slash relative paths: node's glob emits native (backslash)
 * separators on Windows, so each match goes through `toSlash` — this is the
 * boundary where external fs output enters the canonical forward-slash space.
 */
declare function scanWithExtensions(stem: string, cwd: string, extensions: readonly string[], exclude?: (name: string) => boolean): AsyncGenerator<string>;
//#endregion
export { ValidFileMatcher, buildViteResolveExtensions, createValidFileMatcher, findFileWithExtensions, findFileWithExts, normalizePageExtensions, normalizeViteResolveExtensions, scanWithExtensions };