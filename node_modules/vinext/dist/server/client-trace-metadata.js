import { escapeHtmlAttr } from "./html.js";
//#region src/server/client-trace-metadata.ts
/**
* Client trace metadata renderer.
*
* When `experimental.clientTraceMetadata` is configured in `next.config`,
* vinext emits `<meta name="..." content="...">` tags in the SSR HTML head
* for each configured key. The values are sourced from the active
* OpenTelemetry context via the registered propagator.
*
* This mirrors Next.js' implementation:
*  - packages/next/src/server/lib/trace/utils.ts (getTracedMetadata)
*  - packages/next/src/server/app-render/make-get-server-inserted-html.tsx (traceMetaTags)
*
* OpenTelemetry is an optional peer — we resolve `@opentelemetry/api` at
* runtime and silently no-op when it is not installed. This matches user
* expectations: apps that don't configure OTel get no meta tags, and apps
* that do get the filtered subset they asked for in `clientTraceMetadata`.
*/
const carrierSetter = { set(carrier, key, value) {
	if (typeof key !== "string" || typeof value !== "string") return;
	carrier.push({
		key,
		value
	});
} };
const OPEN_TELEMETRY_API_SYMBOL = Symbol.for("opentelemetry.js.api.1");
const OPEN_TELEMETRY_SPAN_SYMBOL = Symbol.for("OpenTelemetry Context Key SPAN");
function getRegisteredOpenTelemetryTraceData() {
	let metadataSpan = null;
	try {
		const registry = globalThis[OPEN_TELEMETRY_API_SYMBOL];
		if (!registry?.context || !registry.propagation) return null;
		const contextApi = registry.context;
		const propagation = registry.propagation;
		const activeContext = contextApi.active();
		metadataSpan = activeContext.getValue(OPEN_TELEMETRY_SPAN_SYMBOL) !== void 0 ? null : registry.trace?.getTracer("vinext").startSpan("vinext.clientTraceMetadata", void 0, activeContext) ?? null;
		const context = metadataSpan ? activeContext.setValue(OPEN_TELEMETRY_SPAN_SYMBOL, metadataSpan) : activeContext;
		const entries = [];
		contextApi.with(context, () => {
			propagation.inject(context, entries, carrierSetter);
		});
		return entries;
	} catch {
		return [];
	} finally {
		metadataSpan?.end();
	}
}
function getOpenTelemetryTraceData() {
	const registeredEntries = getRegisteredOpenTelemetryTraceData();
	if (registeredEntries) return registeredEntries;
	let api;
	try {
		const req = globalThis.require;
		if (typeof req === "function") api = req("@opentelemetry/api");
	} catch {
		return [];
	}
	if (!api) return [];
	try {
		const activeContext = api.context.active();
		const entries = [];
		api.propagation.inject(activeContext, entries, carrierSetter);
		return entries;
	} catch {
		return [];
	}
}
/**
* Filter an entry list against the configured `clientTraceMetadata` allow-list.
* Returns `undefined` when the allow-list is unset so callers can skip
* rendering altogether.
*/
function filterClientTraceMetadata(entries, allowList) {
	if (!allowList || allowList.length === 0) return void 0;
	const allowSet = new Set(allowList);
	return entries.filter(({ key }) => allowSet.has(key));
}
/**
* Render the filtered entries as a sequence of self-closing `<meta>` tags.
* Names and values are HTML-attribute escaped. Returns an empty string when
* `entries` is empty or undefined so callers can append unconditionally.
*/
function renderClientTraceMetadataTags(entries) {
	if (!entries || entries.length === 0) return "";
	let html = "";
	for (const { key, value } of entries) html += `<meta name="${escapeHtmlAttr(key)}" content="${escapeHtmlAttr(value)}"/>`;
	return html;
}
/**
* Convenience helper: read OTel propagation data, filter against the
* configured allow-list, and render the resulting `<meta>` tags. Returns an
* empty string when the allow-list is unset, OTel is not installed, or no
* matching keys were emitted by the propagator.
*
* Safe to call unconditionally on every SSR render — when nothing is
* configured/active this is a few `try/catch`-bounded operations and returns
* `""`.
*/
function getClientTraceMetadataHTML(allowList) {
	if (!allowList || allowList.length === 0) return "";
	if (typeof process !== "undefined" && process.env.VINEXT_PRERENDER === "1") return "";
	return renderClientTraceMetadataTags(filterClientTraceMetadata(getOpenTelemetryTraceData(), allowList));
}
//#endregion
export { filterClientTraceMetadata, getClientTraceMetadataHTML, renderClientTraceMetadataTags };
