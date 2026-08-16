//#region src/server/app-rsc-embedded-chunks.d.ts
declare const RSC_EMBEDDED_BINARY_CHUNK = 3;
type RscEmbeddedChunk = string | [typeof RSC_EMBEDDED_BINARY_CHUNK, string];
declare function bytesToBase64(bytes: Uint8Array): string;
declare function decodeRscEmbeddedChunk(chunk: RscEmbeddedChunk): Uint8Array;
declare function concatUint8Arrays(chunks: readonly Uint8Array[]): Uint8Array<ArrayBuffer>;
//#endregion
export { RSC_EMBEDDED_BINARY_CHUNK, RscEmbeddedChunk, bytesToBase64, concatUint8Arrays, decodeRscEmbeddedChunk };