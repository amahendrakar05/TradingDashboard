import { isUnknownRecord } from "../utils/record.js";
//#region src/client/vinext-next-data.ts
function extractVinextNextDataJson(html) {
	const canonical = /<script\b(?=[^>]*\bid=["']__NEXT_DATA__["'])(?=[^>]*\btype=["']application\/json["'])[^>]*>([\s\S]*?)<\/script>/.exec(html);
	if (canonical) return canonical[1];
	const assignment = /<script(?:\s[^>]*)?>\s*window\.__NEXT_DATA__\s*=\s*/.exec(html);
	if (!assignment || assignment.index === void 0) return null;
	let start = assignment.index + assignment[0].length;
	while (html[start] === " " || html[start] === "\n" || html[start] === "	" || html[start] === "\r") start++;
	if (html[start] !== "{") return null;
	let depth = 0;
	let inString = false;
	let escaped = false;
	for (let index = start; index < html.length; index++) {
		const char = html[index];
		if (inString) {
			if (escaped) escaped = false;
			else if (char === "\\") escaped = true;
			else if (char === "\"") inString = false;
			continue;
		}
		if (char === "\"") inString = true;
		else if (char === "{") depth++;
		else if (char === "}") {
			depth--;
			if (depth === 0) return html.slice(start, index + 1);
		}
	}
	return null;
}
function parseVinextNextDataJson(json) {
	const parsed = JSON.parse(json);
	if (!isBrowserVinextNextData(parsed)) throw new Error("Navigation failed: invalid __NEXT_DATA__ in response");
	return parsed;
}
function isBrowserVinextNextData(value) {
	if (!isUnknownRecord(value)) return false;
	const props = value.props;
	const page = value.page;
	const query = value.query;
	const vinext = value.__vinext;
	return isUnknownRecord(props) && typeof page === "string" && isUnknownRecord(query) && (vinext === void 0 || isUnknownRecord(vinext));
}
function applyVinextLocaleGlobals(target, nextData) {
	if (nextData.locale !== void 0) target.__VINEXT_LOCALE__ = nextData.locale;
	if (nextData.locales !== void 0) target.__VINEXT_LOCALES__ = [...nextData.locales];
	if (nextData.defaultLocale !== void 0) target.__VINEXT_DEFAULT_LOCALE__ = nextData.defaultLocale;
}
//#endregion
export { applyVinextLocaleGlobals, extractVinextNextDataJson, parseVinextNextDataJson };
