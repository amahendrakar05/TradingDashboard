import { AppElementsInterception } from "./app-elements-wire.js";
//#region src/server/app-page-render-identity.d.ts
type AppPageRenderIdentityInput = {
  displayPathname: string;
  matchedRoutePathname?: string;
  targetMatchedPathname?: string;
  interceptionContext?: string | null;
  interceptSourceMatchedUrl?: string | null;
  interceptSlotId?: string | null;
};
type AppPageRenderIdentity = {
  displayPathname: string;
  interception: AppElementsInterception | null;
  interceptionContext: string | null;
  matchedRoutePathname: string;
  pageId: string;
  routeId: string;
  targetMatchedPathname: string;
};
declare function normalizeAppPageInterceptionProofPathname(pathname: string | null): string | null;
declare function createAppPageRenderIdentity(input: AppPageRenderIdentityInput): AppPageRenderIdentity;
//#endregion
export { AppPageRenderIdentity, createAppPageRenderIdentity, normalizeAppPageInterceptionProofPathname };