//#region src/utils/path.ts
const isWindows = process.platform === "win32";
function stripViteModuleQuery(id) {
	const queryIndex = id.search(/[?#]/);
	return queryIndex === -1 ? id : id.slice(0, queryIndex);
}
/** Strip a trailing `.js` extension from a module specifier so
*  `resolveShimModulePath` looks for the correct base name (e.g. `headers.js`
*  → `headers`). Public and internal shim imports may carry extensionful
*  subpaths; normalising before resolution prevents looking for non-existent
*  files like `headers.js.ts`. */
function stripJsExtension(name) {
	return name.endsWith(".js") ? name.slice(0, -3) : name;
}
//#endregion
export { isWindows, stripJsExtension, stripViteModuleQuery };
