//#region src/server/pages-dev-hydration.d.ts
type PagesDevHydrationOptions = {
  appModuleSource: string | null;
  forceRouterReady?: boolean;
  normalizePageProps?: boolean;
  pageModuleSource: string;
  reactStrictMode: boolean;
  replaceFallbackRoute?: boolean;
  scriptNonce?: string;
  setPagePatternsFromNextData?: boolean;
};
declare function createPagesDevHydrationScript(options: PagesDevHydrationOptions): string;
//#endregion
export { PagesDevHydrationOptions, createPagesDevHydrationScript };