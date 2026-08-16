import { ResolvedNextConfig } from "../config/next-config.js";
import { createValidFileMatcher } from "../routing/file-matcher.js";

//#region src/entries/pages-server-entry.d.ts
/**
 * Generate the virtual SSR server entry module.
 * This is the entry point for `vite build --ssr`.
 */
declare function generateServerEntry(pagesDir: string, nextConfig: ResolvedNextConfig, fileMatcher: ReturnType<typeof createValidFileMatcher>, middlewarePath: string | null, instrumentationPath: string | null): Promise<string>;
//#endregion
export { generateServerEntry };