//#region src/utils/has-trailing-comma.ts
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
function lastSignificantChar(source) {
	let last = "";
	let i = 0;
	const n = source.length;
	while (i < n) {
		const c = source[i];
		const next = source[i + 1];
		if (c === "/" && next === "/") {
			i += 2;
			while (i < n && source[i] !== "\n") i += 1;
			continue;
		}
		if (c === "/" && next === "*") {
			i += 2;
			while (i < n && !(source[i] === "*" && source[i + 1] === "/")) i += 1;
			i += 2;
			continue;
		}
		if (c === "\"" || c === "'" || c === "`") {
			i += 1;
			while (i < n && source[i] !== c) {
				if (source[i] === "\\") i += 1;
				i += 1;
			}
			last = c;
			i += 1;
			continue;
		}
		if (/\s/.test(c)) {
			i += 1;
			continue;
		}
		last = c;
		i += 1;
	}
	return last;
}
/**
* True when `source` ends — ignoring trailing whitespace and comments — with a
* real trailing comma. Used to avoid splicing a second comma (`,,` is a syntax
* error) when injecting a property or argument into existing source.
*/
function hasTrailingComma(source) {
	return lastSignificantChar(source) === ",";
}
//#endregion
export { hasTrailingComma, lastSignificantChar };
