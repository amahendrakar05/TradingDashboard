import { RedirectDigest } from "../utils/redirect-digest.js";

//#region src/server/next-error-digest.d.ts
type NextRedirectDigest = RedirectDigest;
type NextHttpErrorDigest = {
  status: number;
};
/**
 * Pulls a stringified `digest` off an unknown thrown value, or returns null
 * when the value is not a digest-bearing error.
 */
declare function getNextErrorDigest(error: unknown): string | null;
/**
 * Parses redirect digests from vinext's encoded three-part form and Next.js's
 * raw, semicolon-terminated form. Returns null when the digest is not a
 * redirect digest. Vinext's encoded URL is decoded with `decodeURIComponent`;
 * Next.js's canonical raw URL is preserved verbatim. The `status` defaults to
 * 307 when omitted; an omitted `type` is left as null so the caller can apply
 * the correct context-sensitive default.
 */
declare function parseNextRedirectDigest(digest: string): NextRedirectDigest | null;
/**
 * Parses a `NEXT_NOT_FOUND` or `NEXT_HTTP_ERROR_FALLBACK;<status>` digest.
 * Returns `{ status: 404 }` for `NEXT_NOT_FOUND` and the parsed status code
 * for the fallback form. Returns null otherwise.
 */
declare function parseNextHttpErrorDigest(digest: string): NextHttpErrorDigest | null;
//#endregion
export { getNextErrorDigest, parseNextHttpErrorDigest, parseNextRedirectDigest };