import path, { toSlash } from "../deps/.pnpm/pathslash@0.1.0/deps/pathslash/dist/index.js";
//#region src/build/css-url-assets.ts
/**
* Next-parity for CSS `url()` asset dependencies.
*
* Next.js (webpack `asset/resource`) emits one output file per *source* file a
* stylesheet references, keyed by module identity. Vite/Rolldown instead dedupe
* emitted assets by *content*: two byte-identical files (`dark.svg`, `dark2.svg`)
* collapse to a single output, and every `url()` that referenced either source
* is rewritten to that one filename — so the second filename disappears.
*
* There is no config switch to disable that dedupe (it is intentional; see
* vitejs/vite#8632). The one native escape hatch is `this.emitFile({ fileName })`:
* assets emitted with an explicit `fileName` are *never* deduped. So we:
*
*   1. mark — during every production CSS transform, tag each relative asset
*      `url()` with a private `?vinext_css_url_asset=<source-basename>` query.
*      Using identical transformed CSS in server and client environments is
*      required because the default CSS Modules scoped name hashes the full CSS
*      text. The marker is also the only durable carrier of per-reference
*      provenance: once Rolldown dedupes, the emitted bundle cannot tell which
*      `url()` came from which source, and bundle metadata records the source
*      set but not the mapping per reference.
*
*   2. restore — at `generateBundle`, read each marked reference's source
*      basename back out. When it differs from the deduped output's basename,
*      emit a sibling file under that source's name (via the `fileName` escape
*      hatch) and rewrite the reference to it. The marker is then stripped.
*
* Each reference resolves from its own marker, so split CSS chunks stay correct
* with no shared cursor or bundle-iteration-order dependence.
*/
const CSS_URL_ASSET_MARKER = "vinext_css_url_asset";
const CSS_URL_RE = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^'")]*?))\s*\)/g;
const CSS_ASSET_EXT_RE = /\.(?:avif|bmp|gif|ico|jpe?g|png|svg|webp|woff2?|eot|ttf|otf|mp4|webm|ogg|mp3|wav|flac|aac|wasm)$/i;
const CSS_REQUEST_RE = /\.(?:css|scss|sass|less|styl|stylus)(?:\?|$)/i;
function basename(value) {
	const normalized = toSlash(value);
	const slash = normalized.lastIndexOf("/");
	return slash === -1 ? normalized : normalized.slice(slash + 1);
}
function stem(fileName) {
	const base = basename(fileName);
	const dot = base.lastIndexOf(".");
	return dot <= 0 ? base : base.slice(0, dot);
}
function splitUrl(url) {
	const hashAt = url.indexOf("#");
	const beforeHash = hashAt === -1 ? url : url.slice(0, hashAt);
	const hash = hashAt === -1 ? "" : url.slice(hashAt);
	const queryAt = beforeHash.indexOf("?");
	if (queryAt === -1) return {
		path: beforeHash,
		query: "",
		hash
	};
	return {
		path: beforeHash.slice(0, queryAt),
		query: beforeHash.slice(queryAt + 1),
		hash
	};
}
function joinUrl({ path, query, hash }) {
	return `${path}${query ? `?${query}` : ""}${hash}`;
}
function decodeURIComponentSafe(value) {
	try {
		return decodeURIComponent(value);
	} catch {
		return value;
	}
}
function getMarker(query) {
	for (const part of query.split("&")) {
		const eq = part.indexOf("=");
		if ((eq === -1 ? part : part.slice(0, eq)) === CSS_URL_ASSET_MARKER) return eq === -1 ? "" : decodeURIComponentSafe(part.slice(eq + 1));
	}
	return null;
}
function dropMarker(query) {
	return query.split("&").filter((part) => (part.indexOf("=") === -1 ? part : part.slice(0, part.indexOf("="))) !== CSS_URL_ASSET_MARKER).join("&");
}
function isRelativeAssetUrl(rawPath) {
	return !(rawPath === "" || rawPath.startsWith("/") || rawPath.startsWith("#") || rawPath.includes("(") || /^[a-zA-Z][\w+.-]*:/.test(rawPath));
}
function rewriteUrlToken(match, nextUrl) {
	if (match[1] !== void 0) return `url("${nextUrl}")`;
	if (match[2] !== void 0) return `url('${nextUrl}')`;
	return `url(${nextUrl})`;
}
function isCssRequest(id) {
	return CSS_REQUEST_RE.test(id);
}
/** Replace every `url(...)` in `code` whose raw URL `replace()` rewrites. */
function rewriteCssUrls(code, replace) {
	let out = "";
	let last = 0;
	let changed = false;
	CSS_URL_RE.lastIndex = 0;
	let match;
	while ((match = CSS_URL_RE.exec(code)) !== null) {
		const rawUrl = match[1] ?? match[2] ?? match[3]?.trim();
		if (!rawUrl) continue;
		const next = replace(rawUrl);
		if (next === null) continue;
		out += code.slice(last, match.index) + rewriteUrlToken(match, next);
		last = match.index + match[0].length;
		changed = true;
	}
	return changed ? out + code.slice(last) : null;
}
/**
* Append the private provenance marker to each relative asset `url()` in a CSS
* source. Idempotent and side-effect free (only adds a query param), so it is
* safe to run on every build-environment stylesheet, vendored CSS included.
*/
function markCssUrlAssetReferences(code, id) {
	if (!isCssRequest(id) || !code.includes("url(")) return null;
	return rewriteCssUrls(code, (rawUrl) => {
		const parts = splitUrl(rawUrl.trim());
		if (!isRelativeAssetUrl(parts.path)) return null;
		if (getMarker(parts.query) !== null) return null;
		const lower = parts.path.toLowerCase();
		if (!CSS_ASSET_EXT_RE.test(lower) || lower.endsWith(".css")) return null;
		const param = `${CSS_URL_ASSET_MARKER}=${encodeURIComponent(basename(parts.path))}`;
		return joinUrl({
			...parts,
			query: parts.query ? `${parts.query}&${param}` : param
		});
	});
}
/** Rebase relative asset URLs when Sass inlines a partial into an entry file. */
function rebaseCssUrlAssetReferences(code, sourceDirectory, targetDirectory) {
	return rewriteCssUrls(code, (rawUrl) => {
		const parts = splitUrl(rawUrl.trim());
		if (!isRelativeAssetUrl(parts.path)) return null;
		const lower = parts.path.toLowerCase();
		if (!CSS_ASSET_EXT_RE.test(lower) || lower.endsWith(".css")) return null;
		const absolutePath = path.resolve(sourceDirectory, parts.path);
		let rebasedPath = path.relative(targetDirectory, absolutePath);
		if (!rebasedPath.startsWith(".")) rebasedPath = `./${rebasedPath}`;
		return joinUrl({
			...parts,
			path: rebasedPath
		});
	});
}
function isCssFileName(fileName) {
	return fileName.toLowerCase().endsWith(".css");
}
/**
* Given a deduped output filename (`media/dark.1a2b3c4d.svg`) and the source
* basename a reference actually wants (`dark2.svg`), produce the sibling output
* filename (`media/dark2.1a2b3c4d.svg`) by swapping the leading name segment
* while preserving the hash + extension. `asset.originalFileNames` tells us
* which source stem the output was named after, so we strip exactly that.
*/
function deriveSiblingFileName(asset, desiredBasename) {
	const fileName = asset.fileName;
	const slash = fileName.lastIndexOf("/");
	const dir = slash === -1 ? "" : fileName.slice(0, slash + 1);
	const outBase = basename(fileName);
	const desiredStem = stem(desiredBasename);
	const sourceStems = [
		...asset.names ?? [],
		asset.name,
		...asset.originalFileNames ?? [],
		asset.originalFileName
	].filter((n) => !!n).map((n) => stem(n)).sort((a, b) => b.length - a.length);
	for (const wStem of sourceStems) if (wStem && (outBase === wStem || outBase.startsWith(`${wStem}.`) || outBase.startsWith(`${wStem}-`))) return `${dir}${desiredStem}${outBase.slice(wStem.length)}`;
	const dot = outBase.indexOf(".");
	return `${dir}${desiredStem}${dot === -1 ? "" : outBase.slice(dot)}`;
}
/**
* Mutates emitted CSS assets in place so byte-identical `url()` dependencies
* keep their distinct Next-compatible filenames. Sibling files are produced via
* `emitRestoredAsset` (which must call `this.emitFile({ type: "asset", fileName,
* source })` — the explicit `fileName` opts out of Rolldown's content dedupe).
*
* Expects CSS to have been marked by `markCssUrlAssetReferences()` first. The
* marker is stripped from all final output here. CSS that Vite inlined into a JS
* chunk (`cssCodeSplit: false` / `?inline`) already has final URLs, so chunk
* code only has the leaked marker stripped — no sibling files are emitted.
*/
function restoreDedupedCssAssetReferences(bundle, emitRestoredAsset) {
	const assetsByBase = /* @__PURE__ */ new Map();
	for (const entry of Object.values(bundle)) if (entry.type === "asset" && !isCssFileName(entry.fileName)) assetsByBase.set(basename(entry.fileName), entry);
	const emitted = new Set(Object.keys(bundle));
	for (const entry of Object.values(bundle)) {
		if (entry.type === "chunk") {
			if (typeof entry.code === "string" && entry.code.includes(CSS_URL_ASSET_MARKER)) entry.code = stripChunkMarkers(entry.code);
			continue;
		}
		if (!isCssFileName(entry.fileName) || typeof entry.source !== "string") continue;
		entry.source = rewriteCssUrls(entry.source, (rawUrl) => {
			const parts = splitUrl(rawUrl);
			const desiredBasename = getMarker(parts.query);
			if (desiredBasename === null) return null;
			const query = dropMarker(parts.query);
			const asset = assetsByBase.get(basename(parts.path));
			if (!asset) return joinUrl({
				...parts,
				query
			});
			const siblingFileName = deriveSiblingFileName(asset, desiredBasename);
			if (siblingFileName === asset.fileName) return joinUrl({
				...parts,
				query
			});
			if (!emitted.has(siblingFileName)) {
				emitted.add(siblingFileName);
				emitRestoredAsset({
					fileName: siblingFileName,
					source: asset.source
				});
			}
			return joinUrl({
				path: parts.path.slice(0, parts.path.length - basename(parts.path).length) + basename(siblingFileName),
				query,
				hash: parts.hash
			});
		}) ?? entry.source;
	}
}
const CSS_URL_MARKER_PARAM_RE = new RegExp(`(\\?)${CSS_URL_ASSET_MARKER}=[^&#'")\\\\\\s]*&|[?&]${CSS_URL_ASSET_MARKER}=[^&#'")\\\\\\s]*`, "g");
function stripChunkMarkers(code) {
	return code.replace(CSS_URL_MARKER_PARAM_RE, (_m, leadingQuestion) => leadingQuestion ? leadingQuestion : "");
}
//#endregion
export { markCssUrlAssetReferences, rebaseCssUrlAssetReferences, restoreDedupedCssAssetReferences };
