//#region src/plugins/ast-utils.d.ts
type AstRecord = {
  type: string;
  start?: number;
  end?: number;
  [key: string]: unknown;
};
type AstRange = AstRecord & {
  start: number;
  end: number;
};
/**
 * Cheap pre-parse gate for plugins that only transform *dynamic* `import(...)`.
 *
 * Static imports — `import x from "..."`, `import { ... } from "..."`,
 * `import "..."` — never place a `(` (nor a comment leading to one) immediately
 * after the `import` keyword. Plugins that act only on dynamic `import(...)` use
 * this to skip `parseAst` for the overwhelming majority of modules in a large
 * app: at ~5k routes, where almost every module is a static-import-only page,
 * it removes most of the build's AST-parse/GC cost. This is a deliberate,
 * measured performance filter — keep it a regex, never a parse.
 *
 * It intentionally errs toward over-matching: a false positive costs one
 * redundant parse, whereas a false negative would silently skip a real dynamic
 * import (a correctness bug). `\s*[(/]` therefore tolerates whitespace and
 * block/line comments between the `import` keyword and its parenthesis.
 *
 * Usable directly as a Rolldown `transform.filter.code` regex, or via
 * {@link mayContainDynamicImport} for an in-handler prescan.
 */
declare const DYNAMIC_IMPORT_PRESCAN: RegExp;
/**
 * Whether `code` might contain a dynamic `import(...)` call. See
 * {@link DYNAMIC_IMPORT_PRESCAN} — a cheap, deliberately over-inclusive regex
 * gate used to avoid parsing static-import-only modules.
 */
declare function mayContainDynamicImport(code: string): boolean;
declare function isAstRecord(value: unknown): value is AstRecord;
declare function nodeArray(value: unknown): unknown[];
declare function hasRange(node: AstRecord | null): node is AstRange;
declare function isIdentifierNamed(value: unknown, name: string): boolean;
declare function getAstName(value: unknown): string | null;
declare function forEachAstChild(node: AstRecord, callback: (child: AstRecord) => void): void;
declare function collectBindingNames(pattern: unknown, target: Set<string>): void;
//#endregion
export { AstRange, AstRecord, DYNAMIC_IMPORT_PRESCAN, collectBindingNames, forEachAstChild, getAstName, hasRange, isAstRecord, isIdentifierNamed, mayContainDynamicImport, nodeArray };