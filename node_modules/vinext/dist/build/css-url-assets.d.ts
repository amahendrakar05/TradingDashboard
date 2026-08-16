import { Rolldown } from "vite";

//#region src/build/css-url-assets.d.ts
type BundleAsset = Rolldown.OutputAsset;
type CssUrlAssetBundle = Rolldown.OutputBundle;
type EmitRestoredCssUrlAsset = (asset: {
  fileName: string;
  source: BundleAsset["source"];
}) => void;
/**
 * Append the private provenance marker to each relative asset `url()` in a CSS
 * source. Idempotent and side-effect free (only adds a query param), so it is
 * safe to run on every build-environment stylesheet, vendored CSS included.
 */
declare function markCssUrlAssetReferences(code: string, id: string): string | null;
/** Rebase relative asset URLs when Sass inlines a partial into an entry file. */
declare function rebaseCssUrlAssetReferences(code: string, sourceDirectory: string, targetDirectory: string): string | null;
/**
 * Mutates emitted CSS assets in place so byte-identical `url()` dependencies
 * keep their distinct Next-compatible filenames. Sibling files are produced via
 * `emitRestoredAsset` (which must call `this.emitFile({ type: "asset", fileName,
 * source })` — the explicit `fileName` opts out of Rolldown's content dedupe).
 *
 * Expects CSS to have been marked by `markCssUrlAssetReferences()` first. The
 * marker is stripped from all final output here. CSS that Vite inlined into a JS
 * chunk (`cssCodeSplit: false` / `?inline`) already has final URLs, so chunk
 * code only has the leaked marker stripped — no sibling files are emitted.
 */
declare function restoreDedupedCssAssetReferences(bundle: CssUrlAssetBundle, emitRestoredAsset: EmitRestoredCssUrlAsset): void;
//#endregion
export { markCssUrlAssetReferences, rebaseCssUrlAssetReferences, restoreDedupedCssAssetReferences };