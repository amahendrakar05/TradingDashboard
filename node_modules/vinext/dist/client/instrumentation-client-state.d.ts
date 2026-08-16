import { ClientInstrumentationHooks } from "./instrumentation-client.js";

//#region src/client/instrumentation-client-state.d.ts
declare function normalizeClientInstrumentationHooks(hooks: ClientInstrumentationHooks): ClientInstrumentationHooks | null;
declare function setClientInstrumentationHooks(hooks: ClientInstrumentationHooks | null): ClientInstrumentationHooks | null;
declare function getClientInstrumentationHooks(): ClientInstrumentationHooks | null;
declare function notifyAppRouterTransitionStart(href: string, navigationType: "push" | "replace" | "traverse"): void;
//#endregion
export { getClientInstrumentationHooks, normalizeClientInstrumentationHooks, notifyAppRouterTransitionStart, setClientInstrumentationHooks };