import { extendTracerProviderForCacheComponents } from "./otel-tracer-extension.js";
//#region src/server/instrumentation-runtime.ts
let initialized = false;
let initPromise = null;
function isOnRequestErrorHandler(value) {
	return typeof value === "function";
}
/**
* Ensure the instrumentation module's `register()` and `onRequestError`
* hooks have been applied exactly once.
*
* After `register()` runs, we extend the OTel tracer provider so that spans
* created inside Cache Component renders (warmup / fallback-resume phases) use
* a fresh OTel context rather than inheriting the prerender work unit store.
* This mirrors Next.js's `afterRegistration()` call in
* `instrumentation-node-extensions.ts`.
*
* @param instrumentationModule - The imported `instrumentation.ts` module.
*   Passed as an argument so the generated entry can import it normally
*   without this helper needing to know the module path.
*/
async function ensureInstrumentationRegistered(instrumentationModule) {
	if (process.env.VINEXT_PRERENDER === "1") return;
	if (initialized) return;
	if (initPromise) return initPromise;
	initPromise = (async () => {
		if (typeof instrumentationModule.register === "function") await instrumentationModule.register();
		extendTracerProviderForCacheComponents();
		if (isOnRequestErrorHandler(instrumentationModule.onRequestError)) globalThis.__VINEXT_onRequestErrorHandler__ = instrumentationModule.onRequestError;
		initialized = true;
	})();
	return initPromise;
}
//#endregion
export { ensureInstrumentationRegistered };
