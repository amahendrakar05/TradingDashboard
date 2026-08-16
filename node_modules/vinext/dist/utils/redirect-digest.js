//#region src/utils/redirect-digest.ts
const NEXT_REDIRECT_PREFIX = "NEXT_REDIRECT;";
function parseRedirectDigest(digest) {
	if (!digest.startsWith(NEXT_REDIRECT_PREFIX)) return null;
	const firstSemi = digest.indexOf(";", 14);
	if (firstSemi === -1) return null;
	const rest = digest.slice(firstSemi + 1);
	const statusMatch = rest.match(/;(303|307|308);?$/);
	const isCanonical = rest !== "" && digest.endsWith(";");
	if (isCanonical && !statusMatch) return null;
	const target = statusMatch ? rest.slice(0, -statusMatch[0].length) : rest;
	let url = target;
	if (!isCanonical) try {
		url = decodeURIComponent(target);
	} catch {
		return null;
	}
	return {
		status: statusMatch ? Number(statusMatch[1]) : 307,
		type: digest.slice(14, firstSemi) || null,
		url
	};
}
//#endregion
export { parseRedirectDigest };
