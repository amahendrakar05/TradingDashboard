//#region src/server/app-ssr-stream.d.ts
type RscEmbedTransform = {
  flush(): string;
  finalize(): Promise<string>; /** Resolves when all raw bytes from the embed stream have been read. */
  getRawBuffer(): Promise<ArrayBuffer>;
};
type HtmlInsertion = string | (() => string);
type InlineCssManifest = Record<string, string>;
type InitialNavigationCacheMetadata = {
  kind: "dynamic" | "static";
  dynamicStaleTimeSeconds?: number;
};
declare function waitAtLeastOneReactRenderTask(): Promise<void>;
declare function navigationRuntimeRscBootstrapExpression(): string;
declare function createNavigationRuntimeRscMetadataScript(params: Record<string, string | string[]>, nav: {
  pathname: string;
  searchParams: [string, string][];
}, dynamicStaleTimeSeconds?: number): string;
/**
 * Create a helper that progressively embeds RSC chunks as inline <script> tags.
 * The browser entry turns the embedded chunks back into Uint8Array data.
 */
declare function createRscEmbedTransform(embedStream: ReadableStream<Uint8Array>, scriptNonce?: string, getInitialNavigationCacheMetadata?: () => InitialNavigationCacheMetadata): RscEmbedTransform;
/**
 * Fix invalid preload "as" values in server-rendered HTML.
 * React Fizz emits <link rel="preload" as="stylesheet"> for CSS, but the
 * HTML spec requires as="style" for <link rel="preload">.
 */
declare function fixPreloadAs(html: string): string;
/**
 * Create the tick-buffered HTML transform that injects RSC scripts between
 * React Fizz flush cycles without corrupting split HTML chunks.
 *
 * Two insertion points are supported in tandem:
 *
 *  - `injectHTML` is emitted immediately before `</head>`. This is where the
 *    bulk of vinext's head additions live (RSC navigation runtime metadata,
 *    bootstrap modulepreload, server-inserted HTML, font preloads, etc.).
 *  - `injectAfterHeadOpenHTML` is emitted immediately after the `<head ...>`
 *    opening tag so the content runs before any React-emitted resource
 *    hints. This is where inline `<Script strategy="beforeInteractive">`
 *    captures land so the no-flash dark-mode pattern works.
 *
 * Fallback behaviour differs by insertion point:
 *
 *  - `injectHTML` is emitted at end-of-stream by the `flush` handler when no
 *    chunk ever contained `</head>` — callers still see the payload on
 *    highly fragmented streams (just at the end of the body rather than in
 *    the head).
 *  - `injectAfterHeadOpenHTML` is silently dropped when `<head ...>` is not
 *    found in a discoverable chunk. Emitting it at end-of-stream would put
 *    it after the document body, defeating the point — the splice has to
 *    happen before resource hints to be useful, so the safer behaviour is
 *    to no-op and let the user-rendered Script (in its source-order
 *    position) ship as-is.
 */
declare function createTickBufferedTransform(rscEmbed: RscEmbedTransform, injectHTML?: HtmlInsertion, injectAfterHeadOpenHTML?: HtmlInsertion, inlineCssManifest?: InlineCssManifest, inlineCssPrependCss?: string, inlineCssPrependFallbackHTML?: string, inlineCssScriptNonce?: string): TransformStream<Uint8Array, Uint8Array>;
//#endregion
export { InitialNavigationCacheMetadata, createNavigationRuntimeRscMetadataScript, createRscEmbedTransform, createTickBufferedTransform, fixPreloadAs, navigationRuntimeRscBootstrapExpression, waitAtLeastOneReactRenderTask };