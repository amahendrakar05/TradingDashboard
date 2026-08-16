//#region src/server/app-action-request.d.ts
declare function isPossibleAppRouteActionRequest(request: Pick<Request, "headers" | "method">): boolean;
//#endregion
export { isPossibleAppRouteActionRequest };