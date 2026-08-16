import { Plugin } from "vite";

//#region src/plugins/async-hooks-stub.d.ts
/**
 * Stubs node:async_hooks in client (browser) builds.
 *
 * Several shims (headers, cache, navigation-state, etc.) import
 * AsyncLocalStorage from node:async_hooks. These shims are aliased
 * globally via resolve.alias so they resolve in every environment.
 * In client builds, Vite externalizes node:async_hooks to an empty
 * __vite-browser-external stub with no named exports, causing Rollup
 * errors. This plugin intercepts node:async_hooks in the client
 * environment and provides a no-op AsyncLocalStorage — semantically
 * correct since shims already guard with `_als.getStore() ?? fallback`.
 */
declare const asyncHooksStubPlugin: Plugin;
//#endregion
export { asyncHooksStubPlugin };