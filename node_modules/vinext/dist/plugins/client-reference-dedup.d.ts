import { Plugin } from "vite";

//#region src/plugins/client-reference-dedup.d.ts
type ReadPackageJson = (path: string) => Promise<string>;
type ClientReferenceDedupOptions = {
  readFile?: ReadPackageJson;
};
type PackageImportSpecifier = {
  packageName: string;
  specifier: string;
};
/**
 * Extract the bare package name from an absolute file path containing node_modules.
 *
 * Handles scoped packages (`@org/name`) and nested node_modules.
 * Returns `null` if the path doesn't contain `/node_modules/`.
 */
declare function extractPackageName(absolutePath: string): string | null;
/**
 * Convert an absolute package file path into the least lossy bare import
 * specifier that can be handed back to Vite's dependency optimizer.
 */
declare function extractPackageImportSpecifier(absolutePath: string, readPackageJson?: ReadPackageJson): Promise<PackageImportSpecifier | null>;
/**
 * Intercepts absolute node_modules path imports originating from RSC
 * `client-in-server-package-proxy` virtual modules in the client environment
 * and redirects them through bare specifier imports. This ensures the browser
 * loads the pre-bundled version (from `.vite/deps/`) rather than the raw ESM
 * file, preventing module duplication and broken React contexts.
 *
 * Dev-only — production builds use the SSR manifest which handles this correctly.
 */
declare function clientReferenceDedupPlugin(options?: ClientReferenceDedupOptions): Plugin;
//#endregion
export { clientReferenceDedupPlugin, extractPackageImportSpecifier, extractPackageName };