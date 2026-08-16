//#region src/server/app-rsc-render-mode.ts
const APP_RSC_RENDER_MODE_NAVIGATION = "navigation";
const APP_RSC_RENDER_MODE_PREFETCH_DYNAMIC_SHELL = "prefetch-dynamic-shell";
const APP_RSC_RENDER_MODE_PREFETCH_LOADING_SHELL = "prefetch-loading-shell";
function getRscRenderModeCacheVariant(mode) {
	if (mode === "prefetch-dynamic-shell") return "prefetch-dynamic-shell";
	if (mode === "prefetch-loading-shell") return "prefetch-loading-shell";
	return null;
}
function parseAppRscRenderMode(value) {
	switch (value) {
		case APP_RSC_RENDER_MODE_PREFETCH_DYNAMIC_SHELL: return APP_RSC_RENDER_MODE_PREFETCH_DYNAMIC_SHELL;
		case APP_RSC_RENDER_MODE_PREFETCH_LOADING_SHELL: return APP_RSC_RENDER_MODE_PREFETCH_LOADING_SHELL;
		default: return APP_RSC_RENDER_MODE_NAVIGATION;
	}
}
//#endregion
export { APP_RSC_RENDER_MODE_NAVIGATION, APP_RSC_RENDER_MODE_PREFETCH_DYNAMIC_SHELL, APP_RSC_RENDER_MODE_PREFETCH_LOADING_SHELL, getRscRenderModeCacheVariant, parseAppRscRenderMode };
