//#region src/server/app-mounted-slots-header.d.ts
/**
 * Normalize the `x-vinext-mounted-slots` header for request handling and cache keying.
 *
 * The browser sends mounted slot ids as a space-separated list in the order slots were
 * rendered, which changes across navigations. This normalizes to a canonical form
 * (sorted, deduplicated) so equivalent slot sets map to the same RSC cache entry.
 *
 * Security: the value flows into the ISR RSC cache key (`appIsrRscKey`). Without
 * bounds, an attacker who controls this header can fabricate unbounded distinct
 * values to fan out KV writes (per-write billing) or fragment the cache. See
 * `SECURITY-AUDIT-2026-05.md` finding F-PROD-1. The legitimate wire format is a
 * whitespace-separated list of `slot:<name>:<treePath>` tokens (see
 * `createAppPayloadSlotId` in `app-elements-wire.ts`); anything else is rejected.
 *
 * Bounds applied:
 *   - Total raw header value capped at MAX_RAW_HEADER_LENGTH bytes (returns null
 *     if exceeded so the request is treated as if the header were absent).
 *   - Each token capped at MAX_TOKEN_LENGTH bytes.
 *   - Token count capped at MAX_SLOT_TOKENS (extras are dropped after sort + dedup).
 *   - Each token must match the legitimate slot-id shape, as defined by the
 *     AppElements wire codec (`AppElementsWire.isSlotId`). Wire-format details
 *     are intentionally kept inside the codec so this module does not duplicate
 *     them. Malformed tokens are dropped silently rather than rejecting the
 *     whole request — this matches the prior forgiving behavior for browsers
 *     that send legitimate but stale formats during rolling deploys.
 *
 * Consumed by:
 *   - app-rsc-request-normalization (request lifecycle, reads incoming header)
 *   - app-elements (outgoing x-vinext-mounted-slots construction)
 *   - isr-cache (RSC cache key generation)
 */
declare function normalizeMountedSlotsHeader(raw: string | null | undefined): string | null;
//#endregion
export { normalizeMountedSlotsHeader };