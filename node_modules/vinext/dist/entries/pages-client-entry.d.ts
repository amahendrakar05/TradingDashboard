import { ResolvedNextConfig } from "../config/next-config.js";
import { createValidFileMatcher } from "../routing/file-matcher.js";
import { StaticMiddlewareMatcher } from "../build/report.js";
import { VinextLinkPrefetchRoute } from "../client/vinext-next-data.js";

//#region src/entries/pages-client-entry.d.ts
declare function generateClientEntry(pagesDir: string, nextConfig: ResolvedNextConfig, fileMatcher: ReturnType<typeof createValidFileMatcher>, options?: {
  appPrefetchRoutes?: readonly VinextLinkPrefetchRoute[];
  instrumentationClientPath?: string | null;
  middlewareMatcher?: StaticMiddlewareMatcher | undefined;
  reactPreamble?: boolean;
}): Promise<string>;
//#endregion
export { generateClientEntry };