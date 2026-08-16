//#region src/typegen.d.ts
type GenerateRouteTypesOptions = {
  root: string;
  appDir?: string | null;
  pageExtensions?: readonly string[];
};
type GenerateRouteTypesResult = {
  routeTypesPath: string;
  nextEnvPath: string;
  nextEnvStatus: "created" | "updated" | "unchanged";
};
declare function nextEnvFileContent(hasNext: boolean, hasAppDir: boolean, eol?: string): string;
declare function generateRouteTypes(options: GenerateRouteTypesOptions): Promise<GenerateRouteTypesResult>;
//#endregion
export { GenerateRouteTypesResult, generateRouteTypes, nextEnvFileContent };