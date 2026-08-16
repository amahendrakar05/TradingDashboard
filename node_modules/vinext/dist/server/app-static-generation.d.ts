import { HeadersContext } from "../shims/headers.js";

//#region src/server/app-static-generation.d.ts
type AppStaticGenerationRouteKind = "page" | "route";
type CreateStaticGenerationHeadersContextOptions = {
  draftModeEnabled?: boolean;
  draftModeSecret?: string;
  dynamicConfig?: string;
  routeKind: AppStaticGenerationRouteKind;
  routePattern?: string;
};
declare function getAppPageStaticGenerationErrorMessage(): string;
declare function getAppRouteStaticGenerationErrorMessage(routePattern?: string, expression?: string): string;
declare function createStaticGenerationHeadersContext(options: CreateStaticGenerationHeadersContextOptions): HeadersContext;
//#endregion
export { createStaticGenerationHeadersContext, getAppPageStaticGenerationErrorMessage, getAppRouteStaticGenerationErrorMessage };