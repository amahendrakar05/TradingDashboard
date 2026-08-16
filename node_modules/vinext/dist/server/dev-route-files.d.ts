import { ValidFileMatcher } from "../routing/file-matcher.js";

//#region src/server/dev-route-files.d.ts
declare function shouldInvalidateAppRouteFile(appDir: string, filePath: string, matcher: ValidFileMatcher): boolean;
//#endregion
export { shouldInvalidateAppRouteFile };