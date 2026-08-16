//#region src/utils/hash.d.ts
/**
 * FNV-1a hash producing a 64-bit result (two 32-bit rounds with different seeds).
 * Used for deterministic key generation where collisions must be rare.
 *
 * This is a vinext-internal format: nothing outside vinext ever compares
 * these values, so the algorithm only needs to be deterministic. For values
 * that must be byte-for-byte identical to what Next.js emits (ETags), use
 * `fnv1a52` below instead — the two are NOT interchangeable.
 */
declare function fnv1a64(input: string): string;
/**
 * FNV-1a hash producing a 52-bit result, a byte-for-byte port of Next.js's
 * `fnv1a52` in packages/next/src/server/lib/etag.ts (itself derived from
 * fnv-plus). Used for ETag generation, where matching Next.js's exact output
 * matters: clients and CDNs holding `If-None-Match` values from a Next.js
 * deployment keep revalidating (304) against vinext for unchanged payloads.
 *
 * Deliberately separate from `fnv1a64` above — that one is a vinext-internal
 * key format and produces different values. Do not swap one for the other.
 */
declare function fnv1a52(str: string): number;
//#endregion
export { fnv1a52, fnv1a64 };