//#region src/routing/route-validation.d.ts
/**
 * Dynamic route validation adapted from Next.js' sorted-routes implementation.
 * Source:
 * https://github.com/vercel/next.js/blob/canary/packages/next/src/shared/lib/router/utils/sorted-routes.ts
 */
declare function patternToNextFormat(pattern: string): string;
declare function validateRoutePatterns(patterns: readonly string[]): void;
//#endregion
export { patternToNextFormat, validateRoutePatterns };