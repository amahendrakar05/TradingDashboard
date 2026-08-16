//#region src/utils/has-trailing-comma.d.ts
/**
 * Return the last syntactically significant character of a JS source fragment,
 * skipping whitespace and comments. A forward scan tracks string and comment
 * state so that `//` or `/*` sequences appearing INSIDE a string literal (e.g. a
 * URL such as `"https://example.com"` or a path with a double slash) are NOT
 * mistaken for comments.
 *
 * This is deliberately stricter than a whole-string comment strip: stripping
 * every `//...`/`/* ... *\/` would also delete those sequences from inside
 * string literals, which can swallow the real trailing comma that follows them
 * and corrupt the trailing-comma / empty-object detection this feeds.
 *
 * Returns "" for an empty / whitespace-only / comment-only fragment.
 */
declare function lastSignificantChar(source: string): string;
/**
 * True when `source` ends — ignoring trailing whitespace and comments — with a
 * real trailing comma. Used to avoid splicing a second comma (`,,` is a syntax
 * error) when injecting a property or argument into existing source.
 */
declare function hasTrailingComma(source: string): boolean;
//#endregion
export { hasTrailingComma, lastSignificantChar };