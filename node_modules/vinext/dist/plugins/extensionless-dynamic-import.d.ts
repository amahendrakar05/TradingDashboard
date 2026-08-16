import { Plugin } from "vite";

//#region src/plugins/extensionless-dynamic-import.d.ts
declare function createExtensionlessDynamicImportPlugin(): Plugin;
//#endregion
export { createExtensionlessDynamicImportPlugin };