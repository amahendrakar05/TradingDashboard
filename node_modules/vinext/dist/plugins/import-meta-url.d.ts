import { Plugin } from "vite";
import MagicString from "magic-string";

//#region src/plugins/import-meta-url.d.ts
type ImportMetaUrlEnvironment = "client" | "server";
type RewriteResult = {
  code: string;
  map: ReturnType<MagicString["generateMap"]>;
};
declare function createImportMetaUrlPlugin(options: {
  getRoot: () => string | undefined;
}): Plugin;
declare function rewriteImportMetaUrl(code: string, id: string, root: string, environment: ImportMetaUrlEnvironment): RewriteResult | null;
declare function rewriteServerCjsGlobals(code: string, id: string, root: string): RewriteResult | null;
//#endregion
export { createImportMetaUrlPlugin, rewriteImportMetaUrl, rewriteServerCjsGlobals };