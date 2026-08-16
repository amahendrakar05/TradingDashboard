import { Plugin } from "vite";

//#region src/plugins/styled-jsx.d.ts
type NextSwcModule = {
  loadBindings(): Promise<unknown>;
  transform(source: string, options: Record<string, unknown>): Promise<{
    code: string;
    map?: string;
  }>;
};
type StyledJsxPluginOptions = {
  importModule?: (url: string) => Promise<NextSwcModule>;
};
declare function createStyledJsxPlugin(initialProjectRoot: string, options?: StyledJsxPluginOptions): Plugin;
//#endregion
export { createStyledJsxPlugin };