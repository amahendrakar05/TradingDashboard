import path from "../deps/.pnpm/pathslash@0.1.0/deps/pathslash/dist/index.js";
import fs from "node:fs";
//#region src/build/next-client-runtime-manifests.ts
function normalizeRewriteForClientManifest(rewrite) {
	if (rewrite.destination.startsWith("/")) return {
		has: rewrite.has,
		source: rewrite.source,
		destination: rewrite.destination
	};
	return {
		has: rewrite.has,
		source: rewrite.source
	};
}
function normalizeRewritesForClientManifest(rewrites) {
	return {
		beforeFiles: rewrites.beforeFiles.map(normalizeRewriteForClientManifest),
		afterFiles: rewrites.afterFiles.map(normalizeRewriteForClientManifest),
		fallback: rewrites.fallback.map(normalizeRewriteForClientManifest)
	};
}
function buildNextClientBuildManifestContent(rewrites) {
	const manifest = {
		__rewrites: normalizeRewritesForClientManifest(rewrites),
		sortedPages: []
	};
	return `self.__BUILD_MANIFEST = ${JSON.stringify(manifest)};self.__BUILD_MANIFEST_CB && self.__BUILD_MANIFEST_CB()`;
}
function buildNextClientSsgManifestContent() {
	return "self.__SSG_MANIFEST=new Set;self.__SSG_MANIFEST_CB&&self.__SSG_MANIFEST_CB()";
}
function emitNextClientRuntimeManifests(options) {
	const manifestDir = path.join(options.clientDir, options.assetsSubdir, options.buildId);
	fs.mkdirSync(manifestDir, { recursive: true });
	fs.writeFileSync(path.join(manifestDir, "_buildManifest.js"), buildNextClientBuildManifestContent(options.rewrites), "utf-8");
	fs.writeFileSync(path.join(manifestDir, "_ssgManifest.js"), buildNextClientSsgManifestContent(), "utf-8");
}
//#endregion
export { buildNextClientBuildManifestContent, buildNextClientSsgManifestContent, emitNextClientRuntimeManifests };
