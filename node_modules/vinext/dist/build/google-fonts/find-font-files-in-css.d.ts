//#region src/build/google-fonts/find-font-files-in-css.d.ts
/**
 * Find all font files in the CSS response and determine which files should be preloaded.
 * In Google Fonts responses, the @font-face's subset is above it in a comment.
 * Walk through the CSS from top to bottom, keeping track of the current subset.
 *
 * Ported from Next.js:
 * packages/font/src/google/find-font-files-in-css.ts
 * https://github.com/vercel/next.js/blob/canary/packages/font/src/google/find-font-files-in-css.ts
 */
declare function findFontFilesInCss(css: string, subsetsToPreload?: string[]): {
  googleFontFileUrl: string;
  preloadFontFile: boolean;
}[];
//#endregion
export { findFontFilesInCss };