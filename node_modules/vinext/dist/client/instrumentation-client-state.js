//#region src/client/instrumentation-client-state.ts
let clientInstrumentationHooks = null;
function normalizeClientInstrumentationHooks(hooks) {
	return Object.values(hooks).some((value) => typeof value === "function") ? hooks : null;
}
function setClientInstrumentationHooks(hooks) {
	clientInstrumentationHooks = hooks;
	return clientInstrumentationHooks;
}
function getClientInstrumentationHooks() {
	return clientInstrumentationHooks;
}
function notifyAppRouterTransitionStart(href, navigationType) {
	clientInstrumentationHooks?.onRouterTransitionStart?.(href, navigationType);
}
//#endregion
export { getClientInstrumentationHooks, normalizeClientInstrumentationHooks, notifyAppRouterTransitionStart, setClientInstrumentationHooks };
