import { createInlineScriptTag, escapeHtmlAttr, htmlTokenListContains, safeJsonStringify } from "./html.js";
import { bytesToBase64, concatUint8Arrays } from "./app-rsc-embedded-chunks.js";
import { NAVIGATION_RUNTIME_SYMBOL_DESCRIPTION } from "../client/navigation-runtime.js";
//#region src/server/app-ssr-stream.ts
function waitAtLeastOneReactRenderTask() {
	return new Promise((resolve) => setTimeout(resolve, 0));
}
const NAVIGATION_RUNTIME_REFERENCE = `self[Symbol.for(${safeJsonStringify(NAVIGATION_RUNTIME_SYMBOL_DESCRIPTION)})]`;
function navigationRuntimeRscBootstrapExpression() {
	return `((${NAVIGATION_RUNTIME_REFERENCE}??={bootstrap:{routeManifest:null},functions:{}}).bootstrap.rsc??={rsc:[]})`;
}
function createNavigationRuntimeRscMetadataScript(params, nav, dynamicStaleTimeSeconds) {
	return "Object.assign(" + navigationRuntimeRscBootstrapExpression() + ",{params:" + safeJsonStringify(params) + ",nav:" + safeJsonStringify(nav) + (dynamicStaleTimeSeconds === void 0 ? "" : ",dynamicStaleTimeSeconds:" + safeJsonStringify(dynamicStaleTimeSeconds)) + "})";
}
function createNavigationRuntimeRscChunkScript(chunk) {
	return navigationRuntimeRscBootstrapExpression() + ".rsc.push(" + safeJsonStringify(chunk) + ")";
}
function createNavigationRuntimeRscDoneScript(metadata) {
	const bootstrap = navigationRuntimeRscBootstrapExpression();
	return (metadata === void 0 ? "" : "Object.assign(" + bootstrap + "," + safeJsonStringify({
		initialCacheKind: metadata.kind,
		...metadata.dynamicStaleTimeSeconds === void 0 ? {} : { dynamicStaleTimeSeconds: metadata.dynamicStaleTimeSeconds }
	}) + ");") + bootstrap + ".done=true";
}
/**
* Create a helper that progressively embeds RSC chunks as inline <script> tags.
* The browser entry turns the embedded chunks back into Uint8Array data.
*/
function createRscEmbedTransform(embedStream, scriptNonce, getInitialNavigationCacheMetadata) {
	const reader = embedStream.getReader();
	let pendingChunks = [];
	const rawChunks = [];
	let reading = false;
	async function pumpReader() {
		if (reading) return;
		reading = true;
		try {
			while (true) {
				const result = await reader.read();
				if (result.done) break;
				rawChunks.push(result.value);
				try {
					const text = new TextDecoder("utf-8", { fatal: true }).decode(result.value);
					pendingChunks.push(text);
				} catch {
					pendingChunks.push([3, bytesToBase64(result.value)]);
				}
			}
		} catch (error) {
			if (process.env.NODE_ENV !== "production") console.warn("[vinext] RSC embed stream read error:", error);
			throw error;
		} finally {
			reading = false;
		}
	}
	const pumpPromise = pumpReader();
	return {
		flush() {
			if (pendingChunks.length === 0) return "";
			const chunks = pendingChunks;
			pendingChunks = [];
			let scripts = "";
			for (const chunk of chunks) scripts += createInlineScriptTag(createNavigationRuntimeRscChunkScript(chunk), scriptNonce);
			return scripts;
		},
		async finalize() {
			await pumpPromise;
			let scripts = this.flush();
			scripts += createInlineScriptTag(createNavigationRuntimeRscDoneScript(getInitialNavigationCacheMetadata?.()), scriptNonce);
			return scripts;
		},
		async getRawBuffer() {
			await pumpPromise;
			const buffer = concatUint8Arrays(rawChunks);
			rawChunks.length = 0;
			return buffer.buffer;
		}
	};
}
/**
* Fix invalid preload "as" values in server-rendered HTML.
* React Fizz emits <link rel="preload" as="stylesheet"> for CSS, but the
* HTML spec requires as="style" for <link rel="preload">.
*/
function fixPreloadAs(html) {
	return html.replace(/<link(?=[^>]*\srel="preload")[^>]*>/g, (tag) => tag.replace(" as=\"stylesheet\"", " as=\"style\""));
}
const LINK_TAG_RE = /<link\b[^>]*>/gi;
const HTML_REWRITE_EXCLUDED_REGION_RE = /<!--[\s\S]*?-->|<(script|style|textarea|title)\b[^>]*>[\s\S]*?<\/\1\s*>/gi;
const HTML_REWRITE_EXCLUDED_REGION_START_RE = /<!--|<(script|style|textarea|title)\b[^>]*>/gi;
const CLOSE_TAG_RES = {
	script: /<\/script\s*>/i,
	style: /<\/style\s*>/i,
	textarea: /<\/textarea\s*>/i,
	title: /<\/title\s*>/i
};
function getHtmlAttribute(tag, name) {
	const attrRe = /\s([^\s"'=<>`]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
	let match;
	while ((match = attrRe.exec(tag)) !== null) {
		if (match[1]?.toLowerCase() !== name.toLowerCase()) continue;
		return match[2] ?? match[3] ?? match[4] ?? "";
	}
	return null;
}
function htmlAttributeHasToken(tag, name, token) {
	return htmlTokenListContains(getHtmlAttribute(tag, name), token);
}
function getInlineCss(manifest, href) {
	if (Object.prototype.hasOwnProperty.call(manifest, href)) return manifest[href] ?? "";
	try {
		const pathname = new URL(href).pathname;
		if (Object.prototype.hasOwnProperty.call(manifest, pathname)) return manifest[pathname] ?? "";
	} catch {}
	return null;
}
const TRAILING_LINK_OPEN_RE = /<link/gi;
function splitTrailingIncompleteLinkTag(html) {
	TRAILING_LINK_OPEN_RE.lastIndex = 0;
	let lastIndex = -1;
	let match;
	while ((match = TRAILING_LINK_OPEN_RE.exec(html)) !== null) lastIndex = match.index;
	if (lastIndex === -1) return {
		complete: html,
		trailing: ""
	};
	if (html.indexOf(">", lastIndex) !== -1) return {
		complete: html,
		trailing: ""
	};
	return {
		complete: html.slice(0, lastIndex),
		trailing: html.slice(lastIndex)
	};
}
function findTrailingOpenHtmlRewriteExcludedRegionStart(html) {
	let match;
	HTML_REWRITE_EXCLUDED_REGION_START_RE.lastIndex = 0;
	while ((match = HTML_REWRITE_EXCLUDED_REGION_START_RE.exec(html)) !== null) {
		const start = match.index;
		if (match[0] === "<!--") {
			const close = html.indexOf("-->", HTML_REWRITE_EXCLUDED_REGION_START_RE.lastIndex);
			if (close === -1) return start;
			HTML_REWRITE_EXCLUDED_REGION_START_RE.lastIndex = close + 3;
			continue;
		}
		const tagName = match[1]?.toLowerCase();
		if (!tagName) continue;
		const closeTagRe = CLOSE_TAG_RES[tagName];
		if (!closeTagRe) continue;
		const close = closeTagRe.exec(html.slice(HTML_REWRITE_EXCLUDED_REGION_START_RE.lastIndex));
		if (!close) return start;
		HTML_REWRITE_EXCLUDED_REGION_START_RE.lastIndex += close.index + close[0].length;
	}
	return null;
}
function splitTrailingInlineCssRewriteBoundary(html) {
	const linkSplit = splitTrailingIncompleteLinkTag(html);
	const incompleteLinkStart = linkSplit.trailing ? linkSplit.complete.length : null;
	const openRegionStart = findTrailingOpenHtmlRewriteExcludedRegionStart(html);
	const trailingStart = incompleteLinkStart === null ? openRegionStart : openRegionStart === null ? incompleteLinkStart : Math.min(incompleteLinkStart, openRegionStart);
	if (trailingStart === null) return {
		complete: html,
		trailing: ""
	};
	return {
		complete: html.slice(0, trailingStart),
		trailing: html.slice(trailingStart)
	};
}
function escapeStyleText(css) {
	return css.replace(/<\/style/gi, "<\\/style");
}
const CSS_PREPEND_UNSAFE_PREAMBLE_RE = /^\uFEFF?(?:\s|\/\*[\s\S]*?\*\/)*@(charset|import|layer|namespace)\b/i;
function canPrependCss(css) {
	return !CSS_PREPEND_UNSAFE_PREAMBLE_RE.test(css);
}
function replaceLinkTags(html, replaceLinkTag) {
	LINK_TAG_RE.lastIndex = 0;
	return html.replace(LINK_TAG_RE, replaceLinkTag);
}
function replaceLinkTagsOutsideRawText(html, replaceLinkTag) {
	let rewritten = "";
	let cursor = 0;
	let match;
	HTML_REWRITE_EXCLUDED_REGION_RE.lastIndex = 0;
	while ((match = HTML_REWRITE_EXCLUDED_REGION_RE.exec(html)) !== null) {
		rewritten += replaceLinkTags(html.slice(cursor, match.index), replaceLinkTag);
		rewritten += match[0];
		cursor = match.index + match[0].length;
	}
	const tail = html.slice(cursor);
	const openRegionStart = findTrailingOpenHtmlRewriteExcludedRegionStart(tail);
	if (openRegionStart === null) return rewritten + replaceLinkTags(tail, replaceLinkTag);
	return rewritten + replaceLinkTags(tail.slice(0, openRegionStart), replaceLinkTag) + tail.slice(openRegionStart);
}
function rewriteInlineCssStylesheetLinks(html, inlineCssManifest, prependCss, ssrScriptNonce) {
	if (!inlineCssManifest || Object.keys(inlineCssManifest).length === 0) return {
		html,
		consumedPrependCss: false
	};
	let consumedPrependCss = false;
	return {
		html: replaceLinkTagsOutsideRawText(html, (tag) => {
			if (!htmlAttributeHasToken(tag, "rel", "stylesheet")) return tag;
			const href = getHtmlAttribute(tag, "href");
			const precedence = getHtmlAttribute(tag, "data-precedence") ?? getHtmlAttribute(tag, "precedence");
			if (!href || !precedence) return tag;
			const css = getInlineCss(inlineCssManifest, href);
			if (css === null) return tag;
			const effectiveNonce = getHtmlAttribute(tag, "nonce") ?? ssrScriptNonce;
			const nonceAttr = effectiveNonce ? ` nonce="${escapeHtmlAttr(effectiveNonce)}"` : "";
			const cssPrefix = !consumedPrependCss && prependCss.length > 0 && canPrependCss(css) ? `${prependCss}\n` : "";
			consumedPrependCss ||= cssPrefix.length > 0;
			return `<style data-vinext-inline-css${nonceAttr} data-precedence="${escapeHtmlAttr(precedence)}" data-href="${escapeHtmlAttr(href)}">${escapeStyleText(cssPrefix + css)}</style>`;
		}),
		consumedPrependCss
	};
}
/**
* Match the `<head ...>` opening tag in a chunk. Matches both bare `<head>`
* and `<head class="foo">` shapes. Used to splice HTML immediately after the
* opening tag so injected content runs before any React-emitted resource
* hints (stylesheets, modulepreloads) that React Float hoists into `<head>`.
*/
const HEAD_OPEN_RE = /<head\b[^>]*>/;
/**
* Final closing tags of the streamed HTML document. We track this suffix
* separately so we can move it to the very end of the stream — trailing flight
* chunks and preinit scripts emitted by `rscEmbed.finalize()` are appended in
* `flush()`, which would otherwise land them after `</body></html>` and break
* any consumer that asserts the document terminates with a well-formed close.
*
* Ported from Next.js: packages/next/src/server/stream-utils/node-web-streams-helper.ts
* https://github.com/vercel/next.js/blob/canary/packages/next/src/server/stream-utils/node-web-streams-helper.ts
* (see `createMoveSuffixStream` and `CLOSE_TAG`)
*/
const DOCUMENT_CLOSE_SUFFIX = "</body></html>";
/**
* Create the tick-buffered HTML transform that injects RSC scripts between
* React Fizz flush cycles without corrupting split HTML chunks.
*
* Two insertion points are supported in tandem:
*
*  - `injectHTML` is emitted immediately before `</head>`. This is where the
*    bulk of vinext's head additions live (RSC navigation runtime metadata,
*    bootstrap modulepreload, server-inserted HTML, font preloads, etc.).
*  - `injectAfterHeadOpenHTML` is emitted immediately after the `<head ...>`
*    opening tag so the content runs before any React-emitted resource
*    hints. This is where inline `<Script strategy="beforeInteractive">`
*    captures land so the no-flash dark-mode pattern works.
*
* Fallback behaviour differs by insertion point:
*
*  - `injectHTML` is emitted at end-of-stream by the `flush` handler when no
*    chunk ever contained `</head>` — callers still see the payload on
*    highly fragmented streams (just at the end of the body rather than in
*    the head).
*  - `injectAfterHeadOpenHTML` is silently dropped when `<head ...>` is not
*    found in a discoverable chunk. Emitting it at end-of-stream would put
*    it after the document body, defeating the point — the splice has to
*    happen before resource hints to be useful, so the safer behaviour is
*    to no-op and let the user-rendered Script (in its source-order
*    position) ship as-is.
*/
function createTickBufferedTransform(rscEmbed, injectHTML = "", injectAfterHeadOpenHTML = "", inlineCssManifest, inlineCssPrependCss = "", inlineCssPrependFallbackHTML = "", inlineCssScriptNonce) {
	const decoder = new TextDecoder();
	const encoder = new TextEncoder();
	const insertsPerFlush = typeof injectHTML === "function";
	let injected = false;
	let preHeadInjected = false;
	let suffixStripped = false;
	let buffered = [];
	let pendingHtml = "";
	let timeoutId = null;
	const hasInlineCssManifest = inlineCssManifest !== void 0 && Object.keys(inlineCssManifest).length > 0;
	/**
	* Strip the first occurrence of `</body></html>` from `chunk` so it can be
	* re-emitted at the very end of the stream. Returns the rewritten chunk and
	* a flag indicating whether a suffix was found. If `suffixStripped` is
	* already true (i.e. an earlier chunk contained the suffix), this is a
	* no-op — additional matches in later chunks shouldn't happen in practice,
	* but we leave them alone to avoid corrupting unexpected output.
	*/
	const stripDocumentCloseSuffix = (chunk) => {
		if (suffixStripped) return chunk;
		const index = chunk.indexOf(DOCUMENT_CLOSE_SUFFIX);
		if (index === -1) return chunk;
		suffixStripped = true;
		return chunk.slice(0, index) + chunk.slice(index + 14);
	};
	const readInsertion = () => typeof injectHTML === "function" ? injectHTML() : injectHTML;
	const readPreHeadInsertion = () => typeof injectAfterHeadOpenHTML === "function" ? injectAfterHeadOpenHTML() : injectAfterHeadOpenHTML;
	const readInlineCssPrependFallback = () => {
		if (!inlineCssPrependCss || !inlineCssPrependFallbackHTML) return "";
		inlineCssPrependCss = "";
		return inlineCssPrependFallbackHTML;
	};
	const emitInsertion = (controller) => {
		const insertion = readInlineCssPrependFallback() + readInsertion();
		if (insertion) controller.enqueue(encoder.encode(insertion));
	};
	/**
	* Splice the pre-head insertion (typically captured beforeInteractive inline
	* scripts) immediately after the `<head ...>` opening tag. Returns the
	* rewritten chunk and a flag indicating whether the splice happened, so the
	* caller can mark `preHeadInjected` and stop scanning further chunks.
	*
	* NOTE: This is called only when `<head ...>` lies fully inside the current
	* tick-buffered batch. We deliberately avoid retaining arbitrary output until
	* a future chunk completes `<head ...>`, which would delay TTFB and complicate
	* the existing `</head>` injection path. In practice React Fizz emits the
	* opening shell as a single batch.
	*/
	const spliceAfterHeadOpen = (chunk) => {
		if (preHeadInjected) return {
			chunk,
			spliced: false
		};
		const insertion = readPreHeadInsertion();
		if (!insertion) return {
			chunk,
			spliced: false
		};
		const match = HEAD_OPEN_RE.exec(chunk);
		if (!match) return {
			chunk,
			spliced: false
		};
		const insertAt = match.index + match[0].length;
		return {
			chunk: chunk.slice(0, insertAt) + insertion + chunk.slice(insertAt),
			spliced: true
		};
	};
	const flushBuffered = (controller, final = false) => {
		if (buffered.length === 0 && !pendingHtml) return;
		const rawHtml = pendingHtml + buffered.join("");
		buffered = [];
		pendingHtml = "";
		const split = final || !hasInlineCssManifest ? {
			complete: rawHtml,
			trailing: ""
		} : splitTrailingInlineCssRewriteBoundary(rawHtml);
		if (split.trailing) pendingHtml = split.trailing;
		if (!split.complete) return;
		if (injected && insertsPerFlush) emitInsertion(controller);
		const preparedHtml = fixPreloadAs(split.complete);
		const inlineCssResult = hasInlineCssManifest ? rewriteInlineCssStylesheetLinks(preparedHtml, inlineCssManifest, inlineCssPrependCss, inlineCssScriptNonce) : {
			html: preparedHtml,
			consumedPrependCss: false
		};
		if (inlineCssResult.consumedPrependCss) inlineCssPrependCss = "";
		let working = inlineCssResult.html;
		if (!preHeadInjected) {
			const result = spliceAfterHeadOpen(working);
			if (result.spliced) {
				working = result.chunk;
				preHeadInjected = true;
			}
		}
		if (!injected) {
			const headEnd = working.indexOf("</head>");
			if (headEnd !== -1) {
				const before = working.slice(0, headEnd);
				const after = stripDocumentCloseSuffix(working.slice(headEnd));
				controller.enqueue(encoder.encode(before + readInlineCssPrependFallback() + readInsertion() + after));
				injected = true;
				return;
			}
		}
		working = stripDocumentCloseSuffix(working);
		controller.enqueue(encoder.encode(working));
	};
	return new TransformStream({
		transform(chunk, controller) {
			buffered.push(decoder.decode(chunk, { stream: true }));
			if (timeoutId !== null) return;
			timeoutId = setTimeout(() => {
				try {
					flushBuffered(controller);
					const rscScripts = rscEmbed.flush();
					if (rscScripts) controller.enqueue(encoder.encode(rscScripts));
				} catch {}
				timeoutId = null;
			}, 0);
		},
		async flush(controller) {
			if (timeoutId !== null) {
				clearTimeout(timeoutId);
				timeoutId = null;
			}
			const remainder = decoder.decode();
			if (remainder) buffered.push(remainder);
			flushBuffered(controller, true);
			if (!injected) {
				emitInsertion(controller);
				injected = true;
			} else if (insertsPerFlush) emitInsertion(controller);
			const finalScripts = await rscEmbed.finalize();
			if (finalScripts) controller.enqueue(encoder.encode(finalScripts));
			controller.enqueue(encoder.encode(DOCUMENT_CLOSE_SUFFIX));
		}
	});
}
//#endregion
export { createNavigationRuntimeRscMetadataScript, createRscEmbedTransform, createTickBufferedTransform, fixPreloadAs, navigationRuntimeRscBootstrapExpression, waitAtLeastOneReactRenderTask };
