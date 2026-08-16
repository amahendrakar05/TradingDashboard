import { Plugin } from "vite";
import MagicString from "magic-string";

//#region src/plugins/css-module-imports.d.ts
type ScriptLanguage = "js" | "jsx" | "ts" | "tsx";
declare function rewriteCssModuleNamespaceImports(code: string, lang?: ScriptLanguage): {
  code: string;
  map: ReturnType<MagicString["generateMap"]>;
} | null;
declare function createCssModuleImportCompatibilityPlugin(options?: {
  compiledMdx?: boolean;
}): Plugin;
//#endregion
export { createCssModuleImportCompatibilityPlugin, rewriteCssModuleNamespaceImports };