import path from "../deps/.pnpm/pathslash@0.1.0/deps/pathslash/dist/index.js";
//#region src/server/pages-dev-module-url.ts
function normalizeBase(base) {
	if (!base || base === "/") return "/";
	return `/${base.replace(/^\/+|\/+$/g, "")}/`;
}
function encodePagesDevModulePath(modulePath) {
	return encodeURI(modulePath).replace(/%5B/gi, "[").replace(/%5D/gi, "]").replace(/\?/g, "%3F").replace(/#/g, "%23");
}
function createPagesDevAssetUrl(assetPath) {
	return "/" + encodePagesDevModulePath(assetPath.replace(/^\/+/, ""));
}
function createPagesDevModuleUrl(viteRoot, moduleFilePath, viteBase) {
	const relativePath = (/^[A-Za-z]:[\\/]/.test(viteRoot) ? path.win32 : path).relative(viteRoot, moduleFilePath);
	return normalizeBase(viteBase) + encodePagesDevModulePath(relativePath);
}
//#endregion
export { createPagesDevAssetUrl, createPagesDevModuleUrl };
