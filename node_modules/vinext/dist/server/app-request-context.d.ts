import { NavigationContext } from "../shims/navigation-context-state.js";
//#region src/server/app-request-context.d.ts
/**
 * Set navigation context in the ALS-backed store. "use client" components
 * rendered during SSR need the pathname/searchParams/params but the SSR
 * environment has a separate module instance of next/navigation.
 *
 * Clearing nav context (ctx === null) also clears root params.
 */
declare function setAppNavigationContext(ctx: NavigationContext | null): void;
/**
 * Clear all per-request ALS state owned by the App Router handler.
 * Must be called before returning a non-page response (redirect, public
 * file proxy, etc.) to prevent state leaking between requests on Workers.
 *
 * Clears: headers, navigation context, root params.
 */
declare function clearAppRequestContext(): void;
//#endregion
export { clearAppRequestContext, setAppNavigationContext };