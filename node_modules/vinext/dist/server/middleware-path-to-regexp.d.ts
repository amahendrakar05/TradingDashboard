//#region src/server/middleware-path-to-regexp.d.ts
type MiddlewarePathToken = string | MiddlewarePathKey;
type MiddlewarePathKey = {
  name: string | number;
  prefix: string;
  suffix: string;
  pattern: string;
  modifier: string;
};
declare function parseMiddlewarePath(value: string): MiddlewarePathToken[];
declare function normalizeMiddlewarePathTokens(tokens: MiddlewarePathToken[]): MiddlewarePathToken[];
declare function middlewarePathTokensToRegExp(tokens: MiddlewarePathToken[]): RegExp;
//#endregion
export { MiddlewarePathKey, MiddlewarePathToken, middlewarePathTokensToRegExp, normalizeMiddlewarePathTokens, parseMiddlewarePath };