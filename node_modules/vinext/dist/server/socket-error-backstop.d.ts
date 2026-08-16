//#region src/server/socket-error-backstop.d.ts
/**
 * Pure predicate: returns the peer-disconnect code when `err` carries
 * one of `ECONNRESET` / `EPIPE` / `ECONNABORTED`, otherwise `undefined`.
 * Exported for unit testing in isolation (no process-state mutation).
 */
declare function peerDisconnectCode(err: unknown): string | undefined;
/**
 * Pure predicate: returns `true` when `err` is a benign failure from a
 * dynamic `import()` of a static asset URL — the "URL dependency" pattern
 * that Next.js tolerates at build time. Two shapes are recognised:
 *
 *   - `ERR_UNKNOWN_FILE_EXTENSION`: the asset resolved on disk but is not an
 *     ES module (e.g. a co-located `./style.css`). The error message ends in
 *     the offending extension in quotes: `... extension ".css" for /path`.
 *   - `ERR_MODULE_NOT_FOUND`: the asset URL did not resolve (the chunk lives
 *     in `dist/server/` but the source asset does not). Node attaches the
 *     unresolved specifier on `err.url`; we match only when it points at a
 *     static-asset extension.
 *
 * Anything outside this allow-list (including missing `.js`/`.mjs`/`.ts`
 * modules with no extension) returns `false` so real bugs still crash.
 * Exported for unit testing in isolation.
 */
declare function isBenignAssetImportError(err: unknown): boolean;
/**
 * Test-only: returns whether the backstop has been installed in this
 * process. Used by the unit test to assert idempotent install via the
 * Symbol.for guard. Not part of the public API.
 */
declare function isSocketErrorBackstopInstalled(): boolean;
declare function installSocketErrorBackstop(): void;
//#endregion
export { installSocketErrorBackstop, isBenignAssetImportError, isSocketErrorBackstopInstalled, peerDisconnectCode };