import { createNonceAttribute, escapeHtmlAttr } from "./html.js";
//#region src/server/before-interactive-head.ts
const VALID_ATTR_NAME = /^[a-zA-Z][\w.-]*$/;
/**
* Render captured `<Script strategy="beforeInteractive">` scripts to HTML,
* ready to splice immediately after `<head ...>` opens. Each entry has already
* had its inline content escaped via `escapeInlineContent(..., "script")`
* inside the Script shim, so this function only quotes the attributes that
* actually go on the tag (id, src, nonce, plus the residual passthroughs).
*
* Keeping this function in its own module makes the boundary obvious: anything
* passed through here is being concatenated directly into HTML; treat the
* inputs accordingly.
*/
function renderBeforeInteractiveInlineScripts(scripts) {
	if (scripts.length === 0) return "";
	let html = "";
	for (const script of scripts) {
		let attrs = "";
		if (script.id) attrs += ` id="${escapeHtmlAttr(script.id)}"`;
		if (script.src) attrs += ` src="${escapeHtmlAttr(script.src)}"`;
		attrs += createNonceAttribute(script.nonce);
		if (script.attributes) for (const [key, value] of Object.entries(script.attributes)) {
			if (!VALID_ATTR_NAME.test(key)) continue;
			if (key === "data-nscript") continue;
			if (value === true) attrs += ` ${key}`;
			else if (typeof value === "string") attrs += ` ${key}="${escapeHtmlAttr(value)}"`;
		}
		attrs += ` data-nscript="beforeInteractive"`;
		html += `<script${attrs}>${script.innerHTML ?? ""}<\/script>`;
	}
	return html;
}
//#endregion
export { renderBeforeInteractiveInlineScripts };
