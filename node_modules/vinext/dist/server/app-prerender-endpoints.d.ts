import { RootParams } from "../shims/root-params.js";

//#region src/server/app-prerender-endpoints.d.ts
type GenerateStaticParams = (args: {
  params: RootParams;
}) => unknown;
type AppPrerenderStaticParamsMap = Record<string, GenerateStaticParams | null | undefined>;
type AppPrerenderRootParamNamesMap = Record<string, readonly string[] | undefined>;
type HandleAppPrerenderEndpointOptions = {
  isPrerenderEnabled?: () => boolean;
  loadPagesRoutes?: () => Promise<unknown>;
  pathname: string;
  rootParamNamesByPattern?: AppPrerenderRootParamNamesMap;
  staticParamsMap: AppPrerenderStaticParamsMap;
};
declare function handleAppPrerenderEndpoint(request: Request, options: HandleAppPrerenderEndpointOptions): Promise<Response | null>;
//#endregion
export { AppPrerenderRootParamNamesMap, AppPrerenderStaticParamsMap, handleAppPrerenderEndpoint };