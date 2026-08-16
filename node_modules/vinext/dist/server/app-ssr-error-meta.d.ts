//#region src/server/app-ssr-error-meta.d.ts
type SsrErrorMetaRenderOptions = {
  basePath?: string;
  nodeEnv?: string;
};
type SsrErrorMetaRenderer = {
  capture: (error: unknown) => void;
  flush: () => string;
};
declare function renderSsrErrorMetaTags(errors: readonly unknown[], options?: SsrErrorMetaRenderOptions): string;
declare function createSsrErrorMetaRenderer(options?: SsrErrorMetaRenderOptions): SsrErrorMetaRenderer;
//#endregion
export { createSsrErrorMetaRenderer, renderSsrErrorMetaTags };