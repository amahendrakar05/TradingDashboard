//#region src/shims/root-params.d.ts
type RootParams = Record<string, string | string[] | undefined>;
type RootParamsState = {
  rootParams: RootParams | null;
};
type RootParamsUsage = {
  kind: "route";
} | {
  kind: "server-action";
} | {
  kind: "route-handler";
  routePattern: string;
};
type RootParamsUsageController = {
  transitionToRender(): void;
};
declare function pickRootParams(params: RootParams, rootParamNames: readonly string[] | null | undefined): RootParams;
declare function setRootParams(params: RootParams | null): void;
declare function getRootParam(name: string): Promise<string | string[] | undefined>;
declare function runWithRootParamsUsage<T>(usage: RootParamsUsage, fn: () => Promise<T>, controller?: RootParamsUsageController): Promise<T>;
declare function runWithRootParamsUsage<T>(usage: RootParamsUsage, fn: () => T | Promise<T>, controller?: RootParamsUsageController): T | Promise<T>;
declare function createRootParamsUsageController(): RootParamsUsageController;
declare function runWithRootParamsScope<T>(params: RootParams, fn: () => Promise<T>): Promise<T>;
declare function runWithRootParamsScope<T>(params: RootParams, fn: () => T | Promise<T>): T | Promise<T>;
//#endregion
export { RootParams, RootParamsState, RootParamsUsage, RootParamsUsageController, createRootParamsUsageController, getRootParam, pickRootParams, runWithRootParamsScope, runWithRootParamsUsage, setRootParams };