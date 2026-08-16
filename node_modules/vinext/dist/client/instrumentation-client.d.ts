//#region src/client/instrumentation-client.d.ts
type ClientInstrumentationHooks = {
  onRouterTransitionStart?: (href: string, navigationType: "push" | "replace" | "traverse") => void;
};
declare const clientInstrumentationHooks: ClientInstrumentationHooks | null;
//#endregion
export { ClientInstrumentationHooks, clientInstrumentationHooks };