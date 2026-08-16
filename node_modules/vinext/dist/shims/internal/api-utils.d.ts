//#region src/shims/internal/api-utils.d.ts
/**
 * Shim for next/dist/server/api-utils
 *
 * Used by: @clerk/nextjs (type-only import of NextApiRequestCookies).
 */
type NextApiRequestCookies = Partial<{
  [key: string]: string;
}>;
type NextApiRequestQuery = Partial<{
  [key: string]: string | string[];
}>;
//#endregion
export { NextApiRequestCookies, NextApiRequestQuery };