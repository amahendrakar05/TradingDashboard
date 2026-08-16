//#region src/entries/runtime-entry-module.d.ts
/**
 * Resolve a sibling module path relative to a caller's `import.meta.url`,
 * returning a forward-slash path safe for embedding in generated code.
 *
 * This is the single place that owns the
 * `fileURLToPath(new URL(rel, base))` + path-separator normalization idiom so
 * callers don't duplicate it.
 *
 * @param rel  - Relative path to the target module (e.g. `"../server/foo.js"`)
 * @param base - The caller's `import.meta.url`
 */
declare function resolveEntryPath(rel: string, base: string): string;
/**
 * Resolve a real runtime module for a virtual entry generator.
 *
 * During local development we want to point at source files (for example `.ts`),
 * while packed builds only contain emitted `.js` files in `dist/`. Probe the
 * common source/build extensions and fall back to the `.js` path that exists in
 * published packages.
 */
declare function resolveRuntimeEntryModule(name: string): string;
declare function resolveClientRuntimeModule(name: string): string;
//#endregion
export { resolveClientRuntimeModule, resolveEntryPath, resolveRuntimeEntryModule };