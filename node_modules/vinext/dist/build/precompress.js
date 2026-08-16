import path from "../deps/.pnpm/pathslash@0.1.0/deps/pathslash/dist/index.js";
import { ASSET_PREFIX_URL_DIR } from "../utils/asset-prefix.js";
import fsp from "node:fs/promises";
import os from "node:os";
import zlib from "node:zlib";
import { promisify } from "node:util";
//#region src/build/precompress.ts
/**
* Build-time precompression for hashed static assets.
*
* Generates .br (brotli q5), .gz (gzip l8), and .zst (zstd l8) files
* alongside compressible assets in dist/client/_next/static/. Served
* directly by the production server — no per-request compression needed
* for immutable build output.
*
* Only targets the hashed-asset directory (immutable) — public directory
* files use on-the-fly compression since they may change between deploys.
*/
const brotliCompress = promisify(zlib.brotliCompress);
const gzip = promisify(zlib.gzip);
const zstdCompress = typeof zlib.zstdCompress === "function" ? promisify(zlib.zstdCompress) : null;
/** File extensions worth compressing (text-based, not already compressed). */
const COMPRESSIBLE_EXTENSIONS = /* @__PURE__ */ new Set([
	".js",
	".mjs",
	".css",
	".html",
	".json",
	".xml",
	".svg",
	".txt",
	".map",
	".wasm"
]);
/** Below this size, compression overhead exceeds savings. */
const MIN_SIZE = 1024;
/**
* Past ~8 parallel files, mixed-size asset sets spend more time queueing zlib
* work than making forward progress. Keep the batch size bounded even on
* higher-core machines.
*/
const CONCURRENCY = Math.min(os.availableParallelism(), 8);
/**
* Walk a directory recursively, yielding relative paths for regular files.
*/
async function* walkFiles(dir, base = dir) {
	let entries;
	try {
		entries = await fsp.readdir(dir, { withFileTypes: true });
	} catch {
		return;
	}
	for (const entry of entries) {
		const fullPath = path.join(dir, entry.name);
		if (entry.isDirectory()) yield* walkFiles(fullPath, base);
		else if (entry.isFile()) yield path.relative(base, fullPath);
	}
}
/**
* Precompress all compressible hashed assets under `clientDir/<assetsDir>/`.
*
* Writes `.br`, `.gz`, and `.zst` files alongside each original.
* Safe to re-run — overwrites existing compressed variants with identical
* output, and never compresses `.br`, `.gz`, or `.zst` files themselves.
*
* `assetsDir` defaults to `"_next/static"` (Next.js's canonical convention,
* matching `resolveAssetsDir("")`). When `assetPrefix` is configured as a
* path prefix the build writes assets to a different directory (e.g.
* `"cdn/_next/static"`); callers should resolve that with
* `resolveAssetsDir(assetPrefix)` and thread it through. Without this,
* `assetPrefix` builds would walk an empty `_next/static/` directory and
* emit zero compressed variants.
*/
async function precompressAssets(clientDir, options = {}) {
	const { assetsDir: assetsSubdir = ASSET_PREFIX_URL_DIR, onProgress } = options;
	const assetsDir = path.join(clientDir, assetsSubdir);
	const result = {
		filesCompressed: 0,
		totalOriginalBytes: 0,
		totalBrotliBytes: 0
	};
	const filePaths = [];
	for await (const relativePath of walkFiles(assetsDir)) {
		const ext = path.extname(relativePath).toLowerCase();
		if (!COMPRESSIBLE_EXTENSIONS.has(ext)) continue;
		filePaths.push(path.join(assetsDir, relativePath));
	}
	let processed = 0;
	for (let i = 0; i < filePaths.length; i += CONCURRENCY) {
		const chunk = filePaths.slice(i, i + CONCURRENCY);
		await Promise.all(chunk.map(async (fullPath) => {
			const content = await fsp.readFile(fullPath);
			if (content.length < MIN_SIZE) return;
			const compressions = [brotliCompress(content, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 5 } }), gzip(content, { level: 8 })];
			if (zstdCompress) compressions.push(zstdCompress(content, { params: { [zlib.constants.ZSTD_c_compressionLevel]: 8 } }));
			const [brContent, gzContent, zstdContent] = await Promise.all(compressions);
			const writes = [fsp.writeFile(fullPath + ".br", brContent), fsp.writeFile(fullPath + ".gz", gzContent)];
			if (zstdContent) writes.push(fsp.writeFile(fullPath + ".zst", zstdContent));
			await Promise.all(writes);
			result.filesCompressed++;
			result.totalOriginalBytes += content.length;
			result.totalBrotliBytes += brContent.length;
		}));
		processed += chunk.length;
		onProgress?.(processed, filePaths.length, path.basename(chunk[chunk.length - 1]));
	}
	return result;
}
//#endregion
export { precompressAssets };
