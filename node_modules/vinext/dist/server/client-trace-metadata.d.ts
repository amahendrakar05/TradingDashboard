//#region src/server/client-trace-metadata.d.ts
type ClientTraceDataEntry = {
  key: string;
  value: string;
};
/**
 * Filter an entry list against the configured `clientTraceMetadata` allow-list.
 * Returns `undefined` when the allow-list is unset so callers can skip
 * rendering altogether.
 */
declare function filterClientTraceMetadata(entries: readonly ClientTraceDataEntry[], allowList: readonly string[] | undefined): ClientTraceDataEntry[] | undefined;
/**
 * Render the filtered entries as a sequence of self-closing `<meta>` tags.
 * Names and values are HTML-attribute escaped. Returns an empty string when
 * `entries` is empty or undefined so callers can append unconditionally.
 */
declare function renderClientTraceMetadataTags(entries: readonly ClientTraceDataEntry[] | undefined): string;
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
declare function getClientTraceMetadataHTML(allowList: readonly string[] | undefined): string;
//#endregion
export { ClientTraceDataEntry, filterClientTraceMetadata, getClientTraceMetadataHTML, renderClientTraceMetadataTags };