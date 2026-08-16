import { NavigationRuntimeSnapshot } from "../client/navigation-runtime.js";
import { RSC_FORM_STATE_GLOBAL } from "./app-browser-hydration.js";
import { RscEmbeddedChunk } from "./app-rsc-embedded-chunks.js";
import { ReactFormState } from "react-dom/client";

//#region src/server/app-browser-stream.d.ts
type VinextBrowserGlobals = {
  __VINEXT_RSC_CHUNKS__?: RscEmbeddedChunk[];
  __VINEXT_RSC_DONE__?: boolean;
  [RSC_FORM_STATE_GLOBAL]?: ReactFormState;
  __VINEXT_RSC_PARAMS__?: Record<string, string | string[]>;
  __VINEXT_RSC_NAV__?: NavigationRuntimeSnapshot;
};
declare function getVinextBrowserGlobal(): typeof globalThis & VinextBrowserGlobals;
/**
 * Convert embedded chunks back to a ReadableStream of Uint8Array chunks.
 */
declare function chunksToReadableStream(chunks: readonly RscEmbeddedChunk[]): ReadableStream<Uint8Array>;
/**
 * Create a ReadableStream from progressively-embedded RSC chunks.
 *
 * The server pushes chunks into the typed navigation runtime via inline
 * <script> tags. We monkey-patch `push()` so new chunks stream to React
 * immediately instead of polling with setTimeout.
 */
declare function createProgressiveRscStream(): ReadableStream<Uint8Array>;
//#endregion
export { chunksToReadableStream, createProgressiveRscStream, getVinextBrowserGlobal };