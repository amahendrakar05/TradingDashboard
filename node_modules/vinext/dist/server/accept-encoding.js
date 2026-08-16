import zlib from "node:zlib";
//#region src/server/accept-encoding.ts
/** Parse an Accept-Encoding header into exact-token numeric qualities. */
function parseAcceptedEncodings(accept) {
	const qualities = /* @__PURE__ */ new Map();
	const orders = /* @__PURE__ */ new Map();
	let wildcardQuality = null;
	for (const [order, part] of accept.split(",").entries()) {
		const trimmed = part.trim();
		if (trimmed.length === 0) continue;
		const semi = trimmed.indexOf(";");
		const token = (semi === -1 ? trimmed : trimmed.slice(0, semi)).trim().toLowerCase();
		if (token.length === 0) continue;
		let quality = 1;
		if (semi !== -1) {
			let qStr;
			for (const param of trimmed.slice(semi + 1).split(";")) {
				const [name, value] = param.trim().split("=");
				if (name !== "q") continue;
				qStr = value ?? "";
				break;
			}
			if (qStr !== void 0) quality = Number.parseFloat(qStr);
		}
		if (token === "*") {
			if (wildcardQuality === null || Number.isNaN(quality) || Number.isNaN(wildcardQuality) || quality >= wildcardQuality) wildcardQuality = quality;
		} else {
			const currentQuality = qualities.get(token);
			if (currentQuality === void 0 || Number.isNaN(quality) || Number.isNaN(currentQuality) || quality >= currentQuality) {
				qualities.set(token, quality);
				orders.set(token, order);
			}
		}
	}
	return {
		qualities,
		orders,
		wildcardQuality
	};
}
/** Return the effective quality for a coding, including wildcard/identity rules. */
function getEncodingQuality(parsed, encoding) {
	const normalized = encoding.toLowerCase();
	const explicit = parsed.qualities.get(normalized);
	if (explicit !== void 0) return Number.isNaN(explicit) ? 0 : explicit;
	if (normalized === "identity") return parsed.wildcardQuality === 0 ? 0 : 1;
	if (parsed.wildcardQuality !== null) return Number.isNaN(parsed.wildcardQuality) ? 0 : parsed.wildcardQuality;
	return 0;
}
function isEncodingAccepted(parsed, encoding) {
	return getEncodingQuality(parsed, encoding) > 0;
}
/** Choose the highest-quality available coding, using array order as the tie-breaker. */
function selectAcceptedEncoding(parsed, available) {
	let selected = null;
	let selectedQuality = 0;
	for (const encoding of available) {
		const quality = getEncodingQuality(parsed, encoding);
		if (quality > selectedQuality) {
			selected = encoding;
			selectedQuality = quality;
		}
	}
	return selected;
}
/**
* Select a content coding while matching Next.js's compression middleware:
* an explicit identity preference can win, but implicit identity remains a
* fallback rather than suppressing an otherwise acceptable encoding.
*/
function selectContentEncoding(parsed, available) {
	const selected = selectAcceptedEncoding(parsed, available);
	if (selected === null) return "identity";
	const identityQuality = parsed.qualities.get("identity");
	if (identityQuality === void 0 || Number.isNaN(identityQuality)) return selected;
	const selectedQuality = getEncodingQuality(parsed, selected);
	if (identityQuality > selectedQuality) return "identity";
	if (identityQuality < selectedQuality) return selected;
	if (!parsed.qualities.has(selected)) return "identity";
	return (parsed.orders.get("identity") ?? Number.POSITIVE_INFINITY) < (parsed.orders.get(selected) ?? Number.POSITIVE_INFINITY) ? "identity" : selected;
}
const HAS_ZSTD = typeof zlib.createZstdCompress === "function";
/** Select by client q-value first, then zstd > br > gzip > deflate > identity. */
function negotiateEncoding(req) {
	const accept = req.headers["accept-encoding"];
	if (typeof accept !== "string") return "identity";
	return selectContentEncoding(parseAcceptedEncodings(accept), [
		...HAS_ZSTD ? ["zstd"] : [],
		"br",
		"gzip",
		"deflate"
	]);
}
//#endregion
export { HAS_ZSTD, getEncodingQuality, isEncodingAccepted, negotiateEncoding, parseAcceptedEncodings, selectAcceptedEncoding, selectContentEncoding };
