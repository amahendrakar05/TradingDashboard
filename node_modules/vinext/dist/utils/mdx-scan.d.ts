//#region src/utils/mdx-scan.d.ts
/** Module-level cache for hasMdxFiles — avoids re-scanning per Vite environment. */
declare const mdxScanCache: Map<string, boolean>;
/**
 * Check if the project has .mdx files in app/ or pages/ directories.
 */
declare function hasMdxFiles(root: string, appDir: string | null, pagesDir: string | null): boolean;
//#endregion
export { hasMdxFiles, mdxScanCache };