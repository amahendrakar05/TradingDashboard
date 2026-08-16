import { createHash } from "node:crypto";
//#region src/plugins/css-data-url.ts
/**
* Virtual module prefix. The leading `\0` is the Rollup/Vite convention for
* synthetic ids; it suppresses on-disk lookups and signals to other plugins
* that the module is virtual. The `.module.css` / `.css` suffix is required so
* Vite's built-in `vite:css` plugin matches the id via its `CSS_LANGS_RE` /
* `cssModuleRE` filters.
*/
const VIRTUAL_PREFIX = "\0vinext-data-css/";
/**
* Matches a CSS data URL string anywhere in source code. The match is bounded
* by the surrounding string quotes (`'` or `"`) so we only rewrite literal
* import specifiers, never identifiers or comments that happen to contain
* `data:text/css`. The closing quote uses a backreference (`\1`) to the
* opening quote, so mixed-quote spans cannot match accidentally.
*
* Groups:
*   1. opening quote (preserved on output; the closing quote is `\1`)
*   2. `+module` MIME suffix, or empty for plain stylesheets
*   3. `;base64` flag, or empty for percent-encoded payloads
*   4. encoded CSS payload
*/
const DATA_URL_IMPORT_RE = /(['"])data:text\/css(\+module)?(;base64)?,([\s\S]*?)\1/g;
/** Quick filter for sources that contain at least one CSS data URL. */
const DATA_URL_HINT = "data:text/css";
function decode(payload, isBase64) {
	if (isBase64) return Buffer.from(payload, "base64").toString("utf8");
	return decodeURIComponent(payload);
}
function hash(text) {
	return createHash("sha1").update(text).digest("hex").slice(0, 16);
}
function dataUrlCssPlugin() {
	const entries = /* @__PURE__ */ new Map();
	return {
		name: "vinext:css-data-url",
		enforce: "pre",
		transform: {
			filter: {
				id: { exclude: new RegExp(`^${VIRTUAL_PREFIX}`) },
				code: DATA_URL_HINT
			},
			handler(code, id) {
				let mutated = false;
				const rewritten = code.replace(DATA_URL_IMPORT_RE, (_match, quote, moduleFlag, base64Flag, payload) => {
					const isModule = moduleFlag === "+module";
					const isBase64 = base64Flag === ";base64";
					let css;
					try {
						css = decode(payload, isBase64);
					} catch (err) {
						throw new Error(`[vinext] Failed to decode CSS data URL import in ${id}: ${err.message}`);
					}
					const ext = isModule ? ".module.css" : ".css";
					const syntheticId = `${VIRTUAL_PREFIX}${hash(css + ext)}${ext}`;
					entries.set(syntheticId, {
						css,
						isModule
					});
					mutated = true;
					return `${quote}${syntheticId}${quote}`;
				});
				if (!mutated) return null;
				return {
					code: rewritten,
					map: null
				};
			}
		},
		resolveId(id) {
			if (id.startsWith(VIRTUAL_PREFIX)) return id;
			return null;
		},
		load(id) {
			const entry = entries.get(id);
			if (!entry) return null;
			return entry.css;
		}
	};
}
//#endregion
export { dataUrlCssPlugin };
