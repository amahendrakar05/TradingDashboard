import { Plugin } from "vite";

//#region src/plugins/require-context.d.ts
declare function createRequireContextPlugin(): Plugin;
//#endregion
export { createRequireContextPlugin };