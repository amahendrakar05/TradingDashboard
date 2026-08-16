//#region src/server/app-page-method.d.ts
type AppPageMethodPolicyOptions = {
  dynamicConfig?: string;
  hasGenerateStaticParams: boolean;
  isDynamicRoute: boolean;
  revalidateSeconds: number | null;
};
type ResolveAppPageMethodResponseOptions = {
  middlewareHeaders?: Headers | null;
  request: Pick<Request, "headers" | "method">;
} & AppPageMethodPolicyOptions;
declare function isStaticOrSsgAppPageCandidate(options: AppPageMethodPolicyOptions): boolean;
declare function resolveAppPageMethodResponse(options: ResolveAppPageMethodResponseOptions): Response | null;
//#endregion
export { isStaticOrSsgAppPageCandidate, resolveAppPageMethodResponse };