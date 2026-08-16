//#region src/server/defer-until-stream-consumed.d.ts
/**
 * Defers cleanup until the downstream consumer drains or cancels the stream.
 */
declare function deferUntilStreamConsumed(stream: ReadableStream<Uint8Array>, onFlush: () => void): ReadableStream<Uint8Array>;
//#endregion
export { deferUntilStreamConsumed };