import { Plugin } from "vite";

//#region src/plugins/instrumentation-client.d.ts
declare function createInstrumentationClientTransformPlugin(getInstrumentationClientPath: () => string | null): Plugin;
//#endregion
export { createInstrumentationClientTransformPlugin };