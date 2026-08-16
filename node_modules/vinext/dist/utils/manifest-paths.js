import { ASSET_PREFIX_URL_DIR, isAbsoluteAssetPrefix, resolveAssetUrlPrefix, resolveAssetsDir } from "./asset-prefix.js";
//#region src/utils/manifest-paths.ts
function normalizeManifestFile(file) {
	return file.startsWith("/") ? file.slice(1) : file;
}
function manifestFileWithBase(file, base) {
	const normalizedFile = normalizeManifestFile(file);
	if (!base || base === "/") return normalizedFile;
	const normalizedBase = normalizeManifestFile(base).replace(/\/+$/, "");
	if (!normalizedBase) return normalizedFile;
	if (normalizedFile.startsWith(normalizedBase + "/")) return normalizedFile;
	return normalizedBase + "/" + normalizedFile;
}
function manifestFileWithAssetPrefix(file, base, assetPrefix) {
	if (!assetPrefix) return manifestFileWithBase(file, base);
	const normalizedFile = normalizeManifestFile(file);
	const onDiskDirPrefix = normalizeManifestFile(resolveAssetsDir(assetPrefix)) + "/";
	const staticDirPrefix = ASSET_PREFIX_URL_DIR + "/";
	const stripped = normalizedFile.startsWith(onDiskDirPrefix) ? normalizedFile.slice(onDiskDirPrefix.length) : normalizedFile.startsWith(staticDirPrefix) ? normalizedFile.slice(staticDirPrefix.length) : normalizedFile;
	const urlPrefix = resolveAssetUrlPrefix(assetPrefix);
	return (isAbsoluteAssetPrefix(assetPrefix) ? urlPrefix : normalizeManifestFile(urlPrefix)) + stripped;
}
function stripBasePathSegment(file, basePath) {
	const normalizedBase = normalizeManifestFile(basePath).replace(/\/+$/, "");
	if (!normalizedBase) return file;
	return file.startsWith(normalizedBase + "/") ? file.slice(normalizedBase.length + 1) : file;
}
/**
* Resolve the URL a client asset is actually SERVED from, starting from a
* base-anchored manifest / SSR-manifest value (no leading slash), e.g.
* `"docs/cdn/_next/static/x.js"`.
*
* Next.js semantics: `assetPrefix` REPLACES `basePath` for asset URLs (they do
* not stack). So when an `assetPrefix` is configured we strip the basePath
* segment and re-anchor under the assetPrefix — matching how `next/dynamic`
* preloads are computed (`manifestFileWithAssetPrefix`) and what the prod server
* / Cloudflare ASSETS binding actually serve. Without this, a `basePath` +
* path-style `assetPrefix` build emits `/<basePath>/<assetPrefix>/_next/...`
* which 404s. When no `assetPrefix` is set, the base-anchored value is already
* the served URL and is returned unchanged (just root-anchored).
*
* Returns an absolute URL for an absolute `assetPrefix`, otherwise a
* root-relative URL beginning with `/`.
*/
function assetServingUrlFromBaseAnchored(value, basePath, assetPrefix) {
	const normalized = normalizeManifestFile(value);
	if (!assetPrefix) return "/" + normalized;
	const anchored = manifestFileWithAssetPrefix(stripBasePathSegment(normalized, basePath), "/", assetPrefix);
	return isAbsoluteAssetPrefix(assetPrefix) ? anchored : "/" + anchored;
}
/**
* Strip a `base` prefix that Vite applied twice: it bakes `base` into the
* on-disk chunk fileName and then prepends it again in `ssr-manifest.json`,
* yielding `docs/docs/_next/static/...` which 404s. Only an exact
* `<base>/<base>/` prefix is collapsed; a single prefix is left untouched.
*/
function collapseDuplicateBase(file, base) {
	const normalizedFile = normalizeManifestFile(file);
	if (!base || base === "/") return normalizedFile;
	const normalizedBase = normalizeManifestFile(base).replace(/\/+$/, "");
	if (!normalizedBase) return normalizedFile;
	const doubledPrefix = `${normalizedBase}/${normalizedBase}/`;
	return normalizedFile.startsWith(doubledPrefix) ? normalizedFile.slice(normalizedBase.length + 1) : normalizedFile;
}
//#endregion
export { assetServingUrlFromBaseAnchored, collapseDuplicateBase, manifestFileWithAssetPrefix, manifestFileWithBase };
