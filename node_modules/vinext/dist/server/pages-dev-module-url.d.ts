//#region src/server/pages-dev-module-url.d.ts
declare function createPagesDevAssetUrl(assetPath: string): string;
declare function createPagesDevModuleUrl(viteRoot: string, moduleFilePath: string, viteBase: string): string;
//#endregion
export { createPagesDevAssetUrl, createPagesDevModuleUrl };