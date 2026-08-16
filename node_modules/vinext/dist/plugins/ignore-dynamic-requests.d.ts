import { Plugin } from "vite";

//#region src/plugins/ignore-dynamic-requests.d.ts
declare function transformVeryDynamicRequests(code: string, id: string): {
  code: string;
  map: import("magic-string").SourceMap;
} | null;
declare function createIgnoreDynamicRequestsPlugin(getTranspiledPackages?: () => readonly string[]): Plugin;
declare const _transformVeryDynamicRequests: typeof transformVeryDynamicRequests;
//#endregion
export { _transformVeryDynamicRequests, createIgnoreDynamicRequestsPlugin };