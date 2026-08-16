import { workUnitAsyncStorage } from "../shims/internal/work-unit-async-storage.js";
//#region src/server/otel-tracer-extension.ts
/**
* OpenTelemetry tracer provider extension for Cache Components.
*
* When `cacheComponents: true` is enabled in next.config, component renders
* go through multiple phases (warmup → resume). During these phases, the
* `workUnitAsyncStorage` carries a prerender or cache store. Without this
* extension, calls to `tracer.startSpan()` / `tracer.startActiveSpan()` from
* inside user RSC code would inherit that prerender context, causing:
*
*  1. Spans to reuse the same trace ID across requests (the frozen prerender
*     context bleeds into the runtime resume render).
*  2. Spans not being created at all during fallback resume (the work unit
*     context gates span creation in some OTel SDK implementations).
*
* The fix mirrors Next.js's `instrumentation-node-extensions.ts`:
*  - Wrap `tracer.startSpan` to exit `workUnitAsyncStorage` before creating
*    the span, ensuring a clean context for span ID generation.
*  - Wrap `tracer.startActiveSpan` similarly and re-enter the work unit store
*    for the callback, so that the callback runs with the correct request
*    context restored.
*
* This extension is intentionally a no-op when:
*  - `@opentelemetry/api` is not installed (graceful degradation).
*  - No OTel tracer provider has been registered (provider is the noop provider).
*  - `workUnitAsyncStorage` has no active store (non-render contexts).
*
* References:
*  - packages/next/src/server/lib/router-utils/instrumentation-node-extensions.ts
*  - https://github.com/vercel/next.js/blob/canary/packages/next/src/server/lib/router-utils/instrumentation-node-extensions.ts
*/
const extendedProviders = /* @__PURE__ */ new WeakSet();
const USE_CACHE_FUNCTION_SYMBOL = Symbol.for("vinext.useCacheFunction");
function isUseCacheFn(fn) {
	return typeof fn === "function" && fn[USE_CACHE_FUNCTION_SYMBOL] === true;
}
/**
* Extend the registered OTel tracer provider so that `startSpan` and
* `startActiveSpan` exit the `workUnitAsyncStorage` context before creating
* spans. This prevents the prerender/cache work unit store from leaking into
* span ID generation during Cache Component fallback resumes.
*
* Safe to call multiple times — subsequent calls are no-ops once the provider
* has been wrapped.
*
* Must only be called in Node.js environments (not Edge runtime).
*/
function extendTracerProviderForCacheComponents() {
	let api;
	try {
		const req = globalThis.require;
		if (typeof req === "function") api = req("@opentelemetry/api");
	} catch {
		return;
	}
	if (!api) return;
	const provider = api.trace.getTracerProvider();
	if (!provider || typeof provider.getTracer !== "function") return;
	if (extendedProviders.has(provider)) return;
	extendedProviders.add(provider);
	const originalGetTracer = provider.getTracer.bind(provider);
	const wrappedTracers = /* @__PURE__ */ new WeakSet();
	provider.getTracer = (...args) => {
		const tracer = originalGetTracer(...args);
		if (!tracer || wrappedTracers.has(tracer)) return tracer;
		const originalStartSpan = tracer.startSpan;
		if (typeof originalStartSpan === "function") tracer.startSpan = (...startSpanArgs) => workUnitAsyncStorage.exit(() => originalStartSpan.apply(tracer, startSpanArgs));
		const originalStartActiveSpan = tracer.startActiveSpan;
		if (typeof originalStartActiveSpan === "function") tracer.startActiveSpan = (...startActiveSpanArgs) => {
			const workUnitStore = workUnitAsyncStorage.getStore();
			if (!workUnitStore) return originalStartActiveSpan.apply(tracer, startActiveSpanArgs);
			let fnIdx = 0;
			if (startActiveSpanArgs.length === 2 && typeof startActiveSpanArgs[1] === "function") fnIdx = 1;
			else if (startActiveSpanArgs.length === 3 && typeof startActiveSpanArgs[2] === "function") fnIdx = 2;
			else if (startActiveSpanArgs.length > 3 && typeof startActiveSpanArgs[3] === "function") fnIdx = 3;
			if (fnIdx > 0) {
				const originalFn = startActiveSpanArgs[fnIdx];
				if (isUseCacheFn(originalFn)) console.error("A Cache Function (`use cache`) was passed to startActiveSpan which means it will receive a Span argument with a possibly random ID on every invocation leading to cache misses. Provide a wrapping function around the Cache Function that does not forward the Span argument to avoid this issue.");
				startActiveSpanArgs[fnIdx] = (...cbArgs) => workUnitAsyncStorage.run(workUnitStore, originalFn, ...cbArgs);
			}
			return workUnitAsyncStorage.exit(() => originalStartActiveSpan.apply(tracer, startActiveSpanArgs));
		};
		wrappedTracers.add(tracer);
		return tracer;
	};
}
//#endregion
export { extendTracerProviderForCacheComponents };
