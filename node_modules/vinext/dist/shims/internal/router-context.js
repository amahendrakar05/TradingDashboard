import { createContext } from "react";
//#region src/shims/internal/router-context.ts
/**
* Shim for next/dist/shared/lib/router-context.shared-runtime
*
* Used by: some testing utilities and older libraries.
* Provides the Pages Router context.
*/
const ROUTER_CONTEXT_KEY = Symbol.for("vinext.routerContext");
const globalState = globalThis;
const RouterContext = globalState[ROUTER_CONTEXT_KEY] ?? (globalState[ROUTER_CONTEXT_KEY] = createContext(null));
//#endregion
export { RouterContext };
