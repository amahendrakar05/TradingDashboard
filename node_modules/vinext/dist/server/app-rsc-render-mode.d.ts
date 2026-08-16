//#region src/server/app-rsc-render-mode.d.ts
type AppRscRenderMode = "navigation" | "prefetch-dynamic-shell" | "prefetch-loading-shell";
declare const APP_RSC_RENDER_MODE_NAVIGATION = "navigation";
declare const APP_RSC_RENDER_MODE_PREFETCH_DYNAMIC_SHELL = "prefetch-dynamic-shell";
declare const APP_RSC_RENDER_MODE_PREFETCH_LOADING_SHELL = "prefetch-loading-shell";
declare function getRscRenderModeCacheVariant(mode: AppRscRenderMode): string | null;
declare function parseAppRscRenderMode(value: string | null): AppRscRenderMode;
//#endregion
export { APP_RSC_RENDER_MODE_NAVIGATION, APP_RSC_RENDER_MODE_PREFETCH_DYNAMIC_SHELL, APP_RSC_RENDER_MODE_PREFETCH_LOADING_SHELL, AppRscRenderMode, getRscRenderModeCacheVariant, parseAppRscRenderMode };