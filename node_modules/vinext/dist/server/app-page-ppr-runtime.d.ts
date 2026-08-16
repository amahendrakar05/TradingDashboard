import { createAppPprFallbackShells } from "./app-ppr-fallback-shell.js";
import { AppPageDispatchRoute, AppPagePprRuntime } from "./app-page-dispatch.js";

//#region src/server/app-page-ppr-runtime.d.ts
declare const appPagePprRuntime: AppPagePprRuntime<AppPageDispatchRoute>;
//#endregion
export { appPagePprRuntime, createAppPprFallbackShells };