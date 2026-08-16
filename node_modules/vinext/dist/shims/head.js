import React, { Children, isValidElement, useEffect, useRef } from "react";
//#region src/shims/head.ts
/**
* next/head shim
*
* In the Pages Router, <Head> manages document <head> elements.
* - On the server: collects elements into a module-level array that the
*   dev-server reads after render and injects into the HTML <head>.
* - On the client: reduces all mounted <Head> instances into one deduped
*   document.head projection and applies it with DOM manipulation.
*/
let _ssrHeadChildren = [];
let _documentInitialHead = [];
/** @internal — exposed for unit tests of the client head projection. */
const _clientHeadChildren = /* @__PURE__ */ new Map();
let _getSSRHeadChildren = () => _ssrHeadChildren;
let _resetSSRHeadImpl = () => {
	_ssrHeadChildren = [];
	_documentInitialHead = [];
};
let _getDocumentInitialHead = () => _documentInitialHead;
let _setDocumentInitialHead = (head) => {
	_documentInitialHead = head;
};
/**
* Register ALS-backed state accessors. Called by head-state.ts on import.
* @internal
*/
function _registerHeadStateAccessors(accessors) {
	_getSSRHeadChildren = accessors.getSSRHeadChildren;
	_resetSSRHeadImpl = accessors.resetSSRHead;
	if (accessors.getDocumentInitialHead) _getDocumentInitialHead = accessors.getDocumentInitialHead;
	if (accessors.setDocumentInitialHead) _setDocumentInitialHead = accessors.setDocumentInitialHead;
}
/** Reset the SSR head collector. Call before render. */
function resetSSRHead() {
	_resetSSRHeadImpl();
}
/**
* Register head tags returned by a user `_document.getInitialProps()` call.
* Mirrors Next.js: `_document` may extend the head array passed to its render,
* and those tags are merged into the final `<head>` output. We treat them the
* same as `next/head` children — they go through the same dedupe pipeline so
* later tags (by key or meta-type) win, matching Next.js semantics.
*
* Pass an empty array (or simply don't call this) to skip the merge.
*/
function setDocumentInitialHead(head) {
	_setDocumentInitialHead(head);
}
/**
* Default head tags emitted alongside every Pages Router render — charset
* first, then viewport. Mirrors Next.js's `defaultHead()` in
* `packages/next/src/shared/lib/head.tsx`, which seeds the head array used
* by `HeadManagerContext` before any user `<Head>` reduces over it.
*
* The canonical Next.js order is `<meta charset>` then `<meta viewport>`
* then user tags, all with `data-next-head=""`. See assertion in
* `test/e2e/next-head/index.test.ts`.
*/
function defaultHead() {
	return [React.createElement("meta", {
		charSet: "utf-8",
		key: "charset"
	}), React.createElement("meta", {
		name: "viewport",
		content: "width=device-width",
		key: "viewport"
	})];
}
/** Get collected head HTML. Call after render. */
function getSSRHeadHTML() {
	return reduceHeadChildren([
		...defaultHead(),
		..._getSSRHeadChildren(),
		..._getDocumentInitialHead()
	]).map((child) => headChildToHTML(child.type, child.props)).filter(Boolean).join("\n  ");
}
/**
* Tags allowed inside <head>. Anything else is silently dropped.
* This prevents injection of dangerous elements like <iframe>, <object>, etc.
*/
const ALLOWED_HEAD_TAGS = /* @__PURE__ */ new Set([
	"title",
	"meta",
	"link",
	"style",
	"script",
	"base",
	"noscript"
]);
const ALLOWED_HEAD_TAGS_LIST = Array.from(ALLOWED_HEAD_TAGS).join(", ");
const META_TYPES = [
	"name",
	"httpEquiv",
	"charSet",
	"itemProp"
];
/** Self-closing tags: no inner content, emit as <tag ... /> */
const SELF_CLOSING_HEAD_TAGS = /* @__PURE__ */ new Set([
	"meta",
	"link",
	"base"
]);
/** Tags whose content is raw text — closing-tag sequences must be escaped during SSR. */
const RAW_CONTENT_TAGS = /* @__PURE__ */ new Set(["script", "style"]);
const INLINE_CLOSE_TAG_RES = {
	script: /<\/(script)/gi,
	style: /<\/(style)/gi
};
function warnDisallowedHeadTag(tag) {
	if (process.env.NODE_ENV !== "production") console.warn(`[vinext] <Head> ignoring disallowed tag <${tag}>. Only ${ALLOWED_HEAD_TAGS_LIST} are allowed.`);
}
function collectHeadElements(list, child) {
	if (child == null || typeof child === "boolean" || typeof child === "string" || typeof child === "number") return list;
	if (!isValidElement(child)) return list;
	if (child.type === React.Fragment) return Children.toArray(child.props.children).reduce(collectHeadElements, list);
	if (typeof child.type !== "string") return list;
	if (!ALLOWED_HEAD_TAGS.has(child.type)) {
		warnDisallowedHeadTag(child.type);
		return list;
	}
	return list.concat(child);
}
function normalizeHeadKey(key) {
	if (key == null || typeof key === "number") return null;
	const normalizedKey = String(key);
	const separatorIndex = normalizedKey.indexOf("$");
	return separatorIndex > 0 ? normalizedKey.slice(separatorIndex + 1) : null;
}
function createUniqueHeadFilter() {
	const keys = /* @__PURE__ */ new Set();
	const tags = /* @__PURE__ */ new Set();
	const metaTypes = /* @__PURE__ */ new Set();
	const metaCategories = /* @__PURE__ */ new Map();
	return (child) => {
		let isUnique = true;
		const normalizedKey = normalizeHeadKey(child.key);
		const hasKey = normalizedKey !== null;
		if (normalizedKey) if (keys.has(normalizedKey)) isUnique = false;
		else keys.add(normalizedKey);
		switch (child.type) {
			case "title":
			case "base":
				if (tags.has(child.type)) isUnique = false;
				else tags.add(child.type);
				break;
			case "meta": {
				const props = child.props;
				for (const metaType of META_TYPES) {
					if (!Object.prototype.hasOwnProperty.call(props, metaType)) continue;
					if (metaType === "charSet") {
						if (metaTypes.has(metaType)) isUnique = false;
						else metaTypes.add(metaType);
						continue;
					}
					const category = props[metaType];
					if (typeof category !== "string") continue;
					let categories = metaCategories.get(metaType);
					if (!categories) {
						categories = /* @__PURE__ */ new Set();
						metaCategories.set(metaType, categories);
					}
					if ((metaType !== "name" || !hasKey) && categories.has(category)) isUnique = false;
					else categories.add(category);
				}
				break;
			}
			default: break;
		}
		return isUnique;
	};
}
function reduceHeadChildren(headChildren) {
	return headChildren.reduce((flattenedChildren, child) => flattenedChildren.concat(Children.toArray(child)), []).reduce(collectHeadElements, []).reverse().filter(createUniqueHeadFilter()).reverse();
}
/**
* Validate an HTML attribute name. Rejects names that could break out of
* the attribute context during SSR serialization, or that represent inline
* event handlers (on*). Only allows alphanumeric characters, hyphens, and
* common data-attribute patterns.
*/
const SAFE_ATTR_NAME_RE = /^[a-zA-Z][a-zA-Z0-9\-:.]*$/;
function isSafeAttrName(name) {
	if (!SAFE_ATTR_NAME_RE.test(name)) return false;
	if (name.length > 2 && name[0] === "o" && name[1] === "n" && name[2] >= "A" && name[2] <= "z") return false;
	return true;
}
/**
* Map React JSX attribute names to their HTML serialised form for the small
* set of head-relevant attributes where the two differ. React's own renderer
* normalises these automatically, but we serialise tags by hand so they reach
* the final HTML in the canonical lowercase / kebab-case shape that browsers
* (and Next.js's `test/e2e/next-head/index.test.ts`) expect.
*/
const JSX_TO_HTML_ATTR_MAP = {
	charSet: "charset",
	httpEquiv: "http-equiv",
	acceptCharset: "accept-charset",
	itemProp: "itemprop",
	itemType: "itemtype",
	itemID: "itemid",
	itemRef: "itemref",
	itemScope: "itemscope",
	crossOrigin: "crossorigin",
	referrerPolicy: "referrerpolicy"
};
function jsxAttrToHtml(name) {
	return JSX_TO_HTML_ATTR_MAP[name] ?? name;
}
/**
* Convert props + tag to an HTML string for SSR head injection.
* Callers must only pass tags that have already been validated against
* ALLOWED_HEAD_TAGS (e.g. via reduceHeadChildren / collectHeadElements).
*/
function headChildToHTML(tag, props) {
	const attrs = [];
	let innerHTML = "";
	const rawHtml = getDangerouslySetInnerHTML(props.dangerouslySetInnerHTML);
	if (rawHtml != null) innerHTML = rawHtml;
	else if (typeof props.children === "string") innerHTML = escapeHTML(props.children);
	else if (Array.isArray(props.children)) innerHTML = escapeHTML(props.children.join(""));
	for (const [key, value] of Object.entries(props)) if (key === "children" || key === "dangerouslySetInnerHTML") continue;
	else if (key === "className") attrs.push(`class="${escapeAttr(String(value))}"`);
	else if (typeof value === "string") {
		if (!isSafeAttrName(key)) continue;
		attrs.push(`${jsxAttrToHtml(key)}="${escapeAttr(value)}"`);
	} else if (typeof value === "boolean" && value) {
		if (!isSafeAttrName(key)) continue;
		attrs.push(jsxAttrToHtml(key));
	}
	const attrStr = attrs.length ? " " + attrs.join(" ") : "";
	if (SELF_CLOSING_HEAD_TAGS.has(tag)) return `<${tag}${attrStr} data-next-head="" />`;
	if (RAW_CONTENT_TAGS.has(tag) && innerHTML) innerHTML = escapeInlineContent(innerHTML, tag);
	return `<${tag}${attrStr} data-next-head="">${innerHTML}</${tag}>`;
}
function escapeHTML(s) {
	return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function escapeAttr(s) {
	return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
/**
* Escape content that will be placed inside a raw <script> or <style> tag
* during SSR. The HTML parser treats `<\/script>` (or `</style>`) as the end
* of the block regardless of JavaScript string context, so any occurrence
* of `</` followed by the tag name must be escaped.
*
* We replace `<\/script` and `</style` (case-insensitive) with `<\/script`
* and `<\/style` respectively. The `<\/` form is harmless in JS/CSS string
* context but prevents the HTML parser from seeing a closing tag.
*/
function escapeInlineContent(content, tag) {
	const pattern = INLINE_CLOSE_TAG_RES[tag];
	if (!pattern) return content;
	return content.replace(pattern, "<\\/$1");
}
function getDangerouslySetInnerHTML(value) {
	if (typeof value !== "object" || value === null) return void 0;
	const html = Reflect.get(value, "__html");
	return typeof html === "string" ? html : void 0;
}
function _applyHeadPropsToElement(domEl, props) {
	const rawHtml = getDangerouslySetInnerHTML(props.dangerouslySetInnerHTML);
	if (rawHtml != null) domEl.innerHTML = rawHtml;
	else if (typeof props.children === "string") domEl.textContent = props.children;
	else if (Array.isArray(props.children)) domEl.textContent = props.children.join("");
	for (const [key, value] of Object.entries(props)) if (key === "children" || key === "dangerouslySetInnerHTML") continue;
	else if (key === "className") domEl.setAttribute("class", String(value));
	else if (typeof value === "boolean" && value) {
		if (!isSafeAttrName(key)) continue;
		domEl.setAttribute(jsxAttrToHtml(key), "");
	} else if (typeof value === "string") {
		if (!isSafeAttrName(key)) continue;
		domEl.setAttribute(jsxAttrToHtml(key), value);
	}
}
/**
* Reconcile the document <head> against the desired projection.
*
* Mirrors Next.js's client `head-manager.ts` `updateElements()`: rather than
* wiping every [data-next-head] node and re-appending (which reorders the
* SSR-emitted tags to the end of <head> and causes flicker on each update),
* we diff the desired tags against the existing ones with isEqualNode(). Tags
* that already match are left untouched in their original DOM position, only
* genuinely new tags are inserted, and stale tags are removed.
*
* The desired list seeds defaultHead() (charset + viewport) ahead of user
* tags — matching the SSR path in getSSRHeadHTML() and Next.js's
* reduceComponents(), which always concatenates defaultHead() on both server
* and client. Without it the first <Head> mount after hydration would drop the
* server-rendered defaults. Users can still override via key="charset" /
* key="viewport" through the dedupe pipeline.
*
* @internal — exported for unit tests; called from the Head client effect.
*/
function _syncClientHead() {
	const headEl = document.head;
	if (!headEl) return;
	const oldTags = new Set(headEl.querySelectorAll("[data-next-head]"));
	const charsetEl = headEl.querySelector("meta[charset]");
	if (charsetEl) oldTags.add(charsetEl);
	const newTags = [];
	for (const child of reduceHeadChildren([...defaultHead(), ..._clientHeadChildren.values()])) {
		if (typeof child.type !== "string") continue;
		const domEl = document.createElement(child.type);
		_applyHeadPropsToElement(domEl, child.props);
		domEl.setAttribute("data-next-head", "");
		let isNew = true;
		for (const oldTag of oldTags) if (oldTag.isEqualNode(domEl)) {
			oldTags.delete(oldTag);
			isNew = false;
			break;
		}
		if (isNew) newTags.push(domEl);
	}
	for (const oldTag of oldTags) oldTag.parentNode?.removeChild(oldTag);
	for (const newTag of newTags) if (newTag.tagName.toLowerCase() === "meta" && newTag.getAttribute("charset") !== null) headEl.prepend(newTag);
	else headEl.appendChild(newTag);
}
function Head({ children }) {
	const headInstanceIdRef = useRef(null);
	if (headInstanceIdRef.current === null) headInstanceIdRef.current = Symbol("vinext-head");
	if (typeof window === "undefined") {
		_getSSRHeadChildren().push(children);
		return React.createElement(React.Fragment);
	}
	useEffect(() => {
		const instanceId = headInstanceIdRef.current;
		_clientHeadChildren.set(instanceId, children);
		_syncClientHead();
		return () => {
			_clientHeadChildren.delete(instanceId);
			_syncClientHead();
		};
	}, [children]);
	return React.createElement(React.Fragment);
}
//#endregion
export { _applyHeadPropsToElement, _clientHeadChildren, _registerHeadStateAccessors, _syncClientHead, Head as default, defaultHead, escapeAttr, escapeInlineContent, getSSRHeadHTML, isSafeAttrName, reduceHeadChildren, resetSSRHead, setDocumentInitialHead };
