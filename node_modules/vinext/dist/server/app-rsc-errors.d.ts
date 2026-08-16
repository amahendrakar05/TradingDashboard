//#region src/server/app-rsc-errors.d.ts
type RscRequestInfo = {
  path: string;
  method: string;
  headers: Record<string, string>;
};
type RscErrorContext = {
  routerKind: "App Router";
  routePath: string;
  routeType: "render";
};
type RscErrorReporter = (error: Error, requestInfo: RscRequestInfo, errorContext: RscErrorContext) => void;
type CreateRscOnErrorHandlerOptions = {
  errorContext: RscErrorContext | null;
  nodeEnv?: string;
  reportRequestError: RscErrorReporter;
  requestInfo: RscRequestInfo | null;
};
declare function hasDigest(error: unknown): error is {
  digest: unknown;
};
/**
 * vinext's mirror of Next.js's `getDigestForWellKnownError`: returns the digest
 * string only when the error is a genuine control-flow signal — a redirect,
 * notFound/HTTP-access fallback, bail-out-to-client-side-rendering, or
 * dynamic-server-usage throw. Any other digest (e.g. a hashed digest stamped on
 * a real error, or an obfuscated digest transported from a nested boundary)
 * returns undefined so the caller still reports it as a real error. Mere
 * presence of a `digest` field is NOT enough — that conflation swallowed a class
 * of server render errors with no instrumentation/telemetry.
 */
declare function getDigestForWellKnownError(error: unknown): string | undefined;
/**
 * djb2 hash matching Next.js's string-hash package for RSC error digests.
 */
declare function errorDigest(input: string): string;
declare function sanitizeErrorForClient(error: unknown, nodeEnv?: "development" | "production" | "test"): unknown;
declare function createRscOnErrorHandler(options: CreateRscOnErrorHandlerOptions): (error: unknown) => string | undefined;
//#endregion
export { createRscOnErrorHandler, errorDigest, getDigestForWellKnownError, hasDigest, sanitizeErrorForClient };