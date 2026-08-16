//#region src/server/otel-tracer-extension.d.ts
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
declare function extendTracerProviderForCacheComponents(): void;
//#endregion
export { extendTracerProviderForCacheComponents };