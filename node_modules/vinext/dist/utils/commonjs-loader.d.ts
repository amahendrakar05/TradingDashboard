//#region src/utils/commonjs-loader.d.ts
declare function shouldRetryAsCommonJs(error: unknown, resolvedPath: string): boolean;
/**
 * Load a `.js` file as CommonJS even when a surrounding `package.json`
 * declares `"type": "module"`. Nested misclassified `.js` dependencies are
 * compiled the same way, while Node keeps handling builtins, JSON, native
 * addons, and correctly classified modules through its normal loader.
 */
declare function loadCommonJsModule(resolvedPath: string): unknown;
/**
 * Import a module normally, retrying only `.js` files that fail because Node
 * classified CommonJS source as ESM.
 */
declare function importExportWithCommonJsFallback(resolvedPath: string): Promise<unknown>;
//#endregion
export { importExportWithCommonJsFallback, loadCommonJsModule, shouldRetryAsCommonJs };