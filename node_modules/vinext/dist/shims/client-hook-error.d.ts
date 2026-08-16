//#region src/shims/client-hook-error.d.ts
/**
 * Shared error helper for client-only hooks called in Server Components.
 *
 * Used by `.react-server.ts` shim variants to provide a clear, actionable
 * error message when a developer forgets the "use client" directive.
 *
 * @see https://github.com/cloudflare/vinext/issues/834
 */
declare function buildClientHookErrorMessage(hookName: string): string;
declare function throwClientHookError(hookName: string): never;
//#endregion
export { buildClientHookErrorMessage, throwClientHookError };