//#region src/utils/text-stream.d.ts
/**
 * Helpers for the repeated `new TextDecoder()` + `ReadableStream` chunk-loop
 * pattern used across the server. Each helper handles the streaming-decode
 * boundary correctly (final empty `decoder.decode()` flush so any incomplete
 * trailing UTF-8 sequence is reported).
 *
 * Sites with additional load-bearing behaviour (line-buffered transforms,
 * raw-byte accumulators, mixed string/Uint8Array streams, cache-key body
 * canonicalisation) intentionally still inline their own decoder.
 */
/**
 * Drain a UTF-8 byte stream and return the full decoded text. The stream
 * reader is released on both success and failure.
 */
declare function readStreamAsText(stream: ReadableStream<Uint8Array>): Promise<string>;
/**
 * Drain a UTF-8 byte stream up to `maxBytes` of *raw* input, returning the
 * decoded text. If the raw size limit is exceeded, cancellation is signalled
 * and `onLimitExceeded` is invoked; it MUST throw — its return type is
 * `never` to enforce that. Each caller passes its own error type.
 *
 * The size check is on raw bytes (pre-decode) to bound memory before
 * paying the decoder cost.
 */
declare function readStreamAsTextWithLimit(stream: ReadableStream<Uint8Array>, maxBytes: number, onLimitExceeded: () => never): Promise<string>;
//#endregion
export { readStreamAsText, readStreamAsTextWithLimit };