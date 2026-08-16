//#region src/server/rsc-stream-hints.d.ts
declare function normalizeReactFlightPreloadHints(stream: ReadableStream<Uint8Array>): ReadableStream<Uint8Array>;
type RscRawRenderer = (model: unknown, options?: unknown) => ReadableStream<Uint8Array>;
type RscRawPrerenderer = (model: unknown, options?: unknown) => Promise<{
  prelude: ReadableStream<Uint8Array>;
}>;
declare function createRscRenderer(render: RscRawRenderer): RscRawRenderer;
declare function createRscPrerenderer(prerender: RscRawPrerenderer): RscRawPrerenderer;
//#endregion
export { RscRawPrerenderer, RscRawRenderer, createRscPrerenderer, createRscRenderer, normalizeReactFlightPreloadHints };