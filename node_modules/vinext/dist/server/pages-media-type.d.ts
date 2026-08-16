//#region src/server/pages-media-type.d.ts
/**
 * Shared media-type helpers and body-parse error for Pages API routes.
 *
 * Used by both api-handler.ts (Pages Router dev/prod with Node.js req/res) and
 * pages-node-compat.ts (Pages Router fetch-based facade for Cloudflare Workers).
 */
declare class PagesBodyParseError extends Error {
  readonly statusCode: number;
  constructor(message: string, statusCode: number);
}
declare function getMediaType(contentType: string | null | undefined): string;
declare function isJsonMediaType(mediaType: string): boolean;
//#endregion
export { PagesBodyParseError, getMediaType, isJsonMediaType };