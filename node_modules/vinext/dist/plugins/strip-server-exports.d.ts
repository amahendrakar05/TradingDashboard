import MagicString from "magic-string";

//#region src/plugins/strip-server-exports.d.ts
declare function hasServerExportCandidate(code: string): boolean;
declare function hasExportAllCandidate(code: string): boolean;
declare function validatePageExports(code: string): void;
type StripServerExportsResult = {
  code: string;
  map: ReturnType<MagicString["generateMap"]>;
};
/**
 * Strip server-only Pages Router data-fetching exports and their unique
 * dependency graph from browser bundles.
 *
 * Ported from Next.js:
 * - test/unit/babel-plugin-next-ssg-transform.test.ts
 * - crates/next-custom-transforms/src/transforms/strip_page_exports.rs
 */
declare function stripServerExports(code: string): StripServerExportsResult | null;
//#endregion
export { hasExportAllCandidate, hasServerExportCandidate, stripServerExports, validatePageExports };