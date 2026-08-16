import { IncomingMessage } from "node:http";

//#region src/server/accept-encoding.d.ts
type ContentEncoding = "zstd" | "br" | "gzip" | "deflate";
type NegotiatedEncoding = ContentEncoding | "identity";
/** Parsed explicit coding qualities plus the wildcard quality, when present. */
type ParsedAcceptEncoding = {
  qualities: Map<string, number>;
  orders: Map<string, number>;
  wildcardQuality: number | null;
};
/** Parse an Accept-Encoding header into exact-token numeric qualities. */
declare function parseAcceptedEncodings(accept: string): ParsedAcceptEncoding;
/** Return the effective quality for a coding, including wildcard/identity rules. */
declare function getEncodingQuality(parsed: ParsedAcceptEncoding, encoding: string): number;
declare function isEncodingAccepted(parsed: ParsedAcceptEncoding, encoding: string): boolean;
/** Choose the highest-quality available coding, using array order as the tie-breaker. */
declare function selectAcceptedEncoding<T extends string>(parsed: ParsedAcceptEncoding, available: readonly T[]): T | null;
/**
 * Select a content coding while matching Next.js's compression middleware:
 * an explicit identity preference can win, but implicit identity remains a
 * fallback rather than suppressing an otherwise acceptable encoding.
 */
declare function selectContentEncoding<T extends ContentEncoding>(parsed: ParsedAcceptEncoding, available: readonly T[]): T | "identity";
declare const HAS_ZSTD: boolean;
/** Select by client q-value first, then zstd > br > gzip > deflate > identity. */
declare function negotiateEncoding(req: IncomingMessage): NegotiatedEncoding;
//#endregion
export { HAS_ZSTD, NegotiatedEncoding, ParsedAcceptEncoding, getEncodingQuality, isEncodingAccepted, negotiateEncoding, parseAcceptedEncodings, selectAcceptedEncoding, selectContentEncoding };