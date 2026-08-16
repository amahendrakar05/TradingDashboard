//#region src/server/prerender-route-params.d.ts
type PrerenderRouteParams = Record<string, string | string[]>;
type PrerenderRouteParamsPayload = {
  fallbackParamNames?: readonly string[];
  params: PrerenderRouteParams;
  routePattern: string;
};
type PrerenderRouteParamsRouteMatch = {
  kind: "exact";
  params: PrerenderRouteParams;
} | {
  fallbackParamNames: readonly string[];
  kind: "fallback-shell";
  params: PrerenderRouteParams;
};
declare function serializePrerenderRouteParamsHeader(payload: PrerenderRouteParamsPayload | null): string | null;
declare function readTrustedPrerenderRouteParamsFromHeaders(headers: Headers, expectedSecret?: string): PrerenderRouteParamsPayload | null;
declare function readTrustedPrerenderRouteParams(request: Request): PrerenderRouteParamsPayload | null;
declare function prerenderRouteParamsPayloadMatchesRoute(payload: PrerenderRouteParamsPayload | null, routePattern: string, params: PrerenderRouteParams): payload is PrerenderRouteParamsPayload;
declare function matchPrerenderRouteParamsPayload(payload: PrerenderRouteParamsPayload | null, routePattern: string, params: PrerenderRouteParams): PrerenderRouteParamsRouteMatch | null;
declare function encodePrerenderRouteParams(pattern: string, params: PrerenderRouteParams, fallbackParamNames?: readonly string[]): PrerenderRouteParamsPayload | null;
//#endregion
export { PrerenderRouteParams, PrerenderRouteParamsPayload, encodePrerenderRouteParams, matchPrerenderRouteParamsPayload, prerenderRouteParamsPayloadMatchesRoute, readTrustedPrerenderRouteParams, readTrustedPrerenderRouteParamsFromHeaders, serializePrerenderRouteParamsHeader };