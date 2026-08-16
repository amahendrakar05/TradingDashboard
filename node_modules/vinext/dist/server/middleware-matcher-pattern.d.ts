import { HasCondition } from "../config/next-config.js";

//#region src/server/middleware-matcher-pattern.d.ts
type CompiledMiddlewareMatcherPattern = {
  regexp: RegExp;
  error?: never;
} | {
  regexp?: never;
  error: string;
  kind: "invalid" | "unsafe";
};
type MiddlewareMatcherObject = {
  source: string;
  locale?: false;
  has?: HasCondition[];
  missing?: HasCondition[];
};
declare function isValidMiddlewareMatcherObjectConfig(value: unknown): value is MiddlewareMatcherObject;
declare function compileMiddlewareMatcherPattern(source: string): CompiledMiddlewareMatcherPattern;
declare function validateMiddlewareMatcherPatterns(value: unknown): void;
//#endregion
export { CompiledMiddlewareMatcherPattern, MiddlewareMatcherObject, compileMiddlewareMatcherPattern, isValidMiddlewareMatcherObjectConfig, validateMiddlewareMatcherPatterns };