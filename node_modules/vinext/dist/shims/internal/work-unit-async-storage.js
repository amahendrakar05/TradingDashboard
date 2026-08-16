import { AsyncLocalStorage } from "node:async_hooks";
//#region src/shims/internal/work-unit-async-storage.ts
/**
* Shim for next/dist/server/app-render/work-unit-async-storage.external
* and next/dist/client/components/request-async-storage.external
*
* Tracks the current rendering context type so that dynamic APIs
* (io, headers, cookies, etc.) can branch on whether they're
* inside a request, prerender, cache scope, or other context.
*
* Used by: @sentry/nextjs (runtime resolve for request context injection),
* io() for hanging-promise behavior during prerendering.
*/
const workUnitAsyncStorage = new AsyncLocalStorage();
const requestAsyncStorage = workUnitAsyncStorage;
//#endregion
export { requestAsyncStorage, workUnitAsyncStorage };
