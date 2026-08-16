//#region src/utils/path.d.ts
declare const isWindows: boolean;
declare function stripViteModuleQuery(id: string): string;
/** Strip a trailing `.js` extension from a module specifier so
 *  `resolveShimModulePath` looks for the correct base name (e.g. `headers.js`
 *  → `headers`). Public and internal shim imports may carry extensionful
 *  subpaths; normalising before resolution prevents looking for non-existent
 *  files like `headers.js.ts`. */
declare function stripJsExtension(name: string): string;
//#endregion
export { isWindows, stripJsExtension, stripViteModuleQuery };