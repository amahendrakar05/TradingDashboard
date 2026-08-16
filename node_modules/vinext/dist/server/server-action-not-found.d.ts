//#region src/server/server-action-not-found.d.ts
declare function getServerActionNotFoundMessage(actionId: string | null): string;
declare function isServerActionNotFoundError(error: unknown, actionId: string | null): boolean;
declare function createServerActionNotFoundResponse(): Response;
/**
 * Throw an `UnrecognizedActionError` when the server reported the requested
 * server action id as unknown (the `x-nextjs-action-not-found` response
 * header); otherwise return so the caller can keep processing the response.
 *
 * The client-side counterpart of `createServerActionNotFoundResponse`. The
 * typed error lets client `catch` blocks call the public
 * `unstable_isUnrecognizedActionError` predicate to detect client/server
 * deployment skew and recover (typically by reloading the page).
 *
 * Mirrors Next.js, whose server-action reducer throws `UnrecognizedActionError`
 * on this same response header:
 * https://github.com/vercel/next.js/blob/canary/packages/next/src/client/components/router-reducer/reducers/server-action-reducer.ts
 */
declare function throwOnServerActionNotFound(response: Pick<Response, "headers">, actionId: string): void;
//#endregion
export { createServerActionNotFoundResponse, getServerActionNotFoundMessage, isServerActionNotFoundError, throwOnServerActionNotFound };