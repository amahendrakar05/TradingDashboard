//#region src/utils/prerender-output-paths.d.ts
/**
 * Determine the HTML output file path for a prerendered URL.
 * Respects trailingSlash config.
 */
declare function getOutputPath(urlPath: string, trailingSlash: boolean): string;
/**
 * Determine the RSC output file path for a prerendered URL.
 * "/blog/hello-world" -> "blog/hello-world.rsc"
 * "/"                 -> "index.rsc"
 */
declare function getRscOutputPath(urlPath: string): string;
//#endregion
export { getOutputPath, getRscOutputPath };