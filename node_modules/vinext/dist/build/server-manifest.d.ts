//#region src/build/server-manifest.d.ts
/**
 * Shared utilities for reading/writing vinext-server.json.
 *
 * Kept in a separate file so both build-time code (prerender.ts) and
 * runtime code (prod-server.ts) can import it without creating a circular
 * dependency.
 */
/**
 * Read the prerender secret from `vinext-server.json` in `serverDir`.
 *
 * Returns `undefined` if the file does not exist or cannot be parsed.
 * Callers that require a secret (i.e. the prerender phase itself) should
 * warn when this returns `undefined`.
 */
declare function readPrerenderSecret(serverDir: string): string | undefined;
//#endregion
export { readPrerenderSecret };