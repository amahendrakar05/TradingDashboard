//#region src/server/pages-client-assets.ts
let pagesClientAssets = {};
function setPagesClientAssets(assets) {
	pagesClientAssets = assets ?? {};
}
function getPagesClientAssets() {
	return pagesClientAssets;
}
//#endregion
export { getPagesClientAssets, setPagesClientAssets };
