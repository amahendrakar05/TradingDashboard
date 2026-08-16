//#region src/plugins/typeof-window.d.ts
type WindowType = "object" | "undefined";
type EnvironmentLike = {
  config: {
    consumer: "client" | "server";
  };
};
declare function getTypeofWindowReplacement(environment: EnvironmentLike): WindowType;
declare function replaceTypeofWindow(code: string, replacement: WindowType, id?: string): {
  code: string;
  map: import("magic-string").SourceMap;
} | null;
//#endregion
export { getTypeofWindowReplacement, replaceTypeofWindow };