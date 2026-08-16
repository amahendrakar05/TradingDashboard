import { htmlTokenListContains } from "./html.js";
//#region src/server/app-inline-css-client.ts
function inlineStyleCoversStylesheetHref(styleHref, linkHref) {
	for (const candidate of styleHref.split(/\s+/)) {
		if (candidate === linkHref) return true;
		try {
			const candidateUrl = new URL(candidate, window.location.href);
			const linkUrl = new URL(linkHref, window.location.href);
			if (candidateUrl.href === linkUrl.href) return true;
		} catch {}
	}
	return false;
}
function isInlineCssStylesheetLinkElement(link) {
	return htmlTokenListContains(link.getAttribute("rel"), "stylesheet") && link.hasAttribute("href") && (link.hasAttribute("data-precedence") || link.hasAttribute("precedence"));
}
function removeStylesheetLinksCoveredByInlineCss() {
	const inlineStyles = document.head.querySelectorAll("style[data-vinext-inline-css][data-href]");
	if (inlineStyles.length === 0) return;
	const links = document.head.querySelectorAll("link[rel][href]");
	for (const link of links) {
		if (!isInlineCssStylesheetLinkElement(link)) continue;
		const href = link.getAttribute("href");
		if (!href) continue;
		for (const style of inlineStyles) {
			const styleHref = style.getAttribute("data-href");
			if (styleHref && inlineStyleCoversStylesheetHref(styleHref, href)) {
				link.remove();
				break;
			}
		}
	}
}
//#endregion
export { isInlineCssStylesheetLinkElement, removeStylesheetLinksCoveredByInlineCss };
