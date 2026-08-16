import { NextI18nConfig } from "../config/next-config.js";
import { MiddlewareMatcherObject } from "./middleware-matcher-pattern.js";

//#region src/server/middleware-matcher.d.ts
type MatcherConfig = string | Array<string | MiddlewareMatcherObject>;
declare function matchesMiddleware(pathname: string, matcher: MatcherConfig | undefined, request?: Request, i18nConfig?: NextI18nConfig | null): boolean;
declare function matchPattern(pathname: string, pattern: string): boolean;
//#endregion
export { MatcherConfig, matchPattern, matchesMiddleware };