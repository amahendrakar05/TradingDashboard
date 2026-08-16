import path, { toSlash } from "../deps/.pnpm/pathslash@0.1.0/deps/pathslash/dist/index.js";
import { ASSET_PREFIX_URL_DIR } from "../utils/asset-prefix.js";
import fsp from "node:fs/promises";
//#region src/server/static-file-cache.ts
/**
* Startup metadata cache for static file serving.
*
* Walks dist/client/ once at server boot, pre-computes response headers for
* every file variant (original, brotli, gzip, zstd), and caches everything
* in memory. The per-request hot path is just: Map.get() → string compare
* (ETag) → writeHead(precomputed) → pipe.
*
* Modeled after sirv's production mode. Key insight from sirv: pre-compute
* ALL response headers at startup — Content-Type, Content-Length, ETag,
* Cache-Control, Content-Encoding, Vary — as reusable objects. The common
* per-request path (no extraHeaders) does zero object allocation for headers.
*/
/** Content-type lookup for static assets. Shared with prod-server.ts. */
const CONTENT_TYPES = {
	".js": "application/javascript",
	".mjs": "application/javascript",
	".css": "text/css",
	".html": "text/html; charset=utf-8",
	".json": "application/json",
	".txt": "text/plain; charset=utf-8",
	".png": "image/png",
	".jpg": "image/jpeg",
	".jpeg": "image/jpeg",
	".gif": "image/gif",
	".svg": "image/svg+xml",
	".ico": "image/x-icon",
	".woff": "font/woff",
	".woff2": "font/woff2",
	".ttf": "font/ttf",
	".eot": "application/vnd.ms-fontobject",
	".webp": "image/webp",
	".avif": "image/avif",
	".map": "application/json",
	".rsc": "text/x-component"
};
/**
* Files below this size are buffered in memory at startup for zero-syscall
* serving via res.end(buffer). Above this, files stream via createReadStream.
* 64KB covers virtually all precompressed assets (a 200KB JS bundle compresses
* to ~50KB with brotli q5).
*/
const BUFFER_THRESHOLD = 64 * 1024;
/**
* In-memory cache of static file metadata, populated once at server startup.
*
* Usage:
*   const cache = await StaticFileCache.create(clientDir);
*   const entry = cache.lookup("/_next/static/app-abc123.js");
*   // entry.br?.headers, entry.original.headers, etc.
*/
var StaticFileCache = class StaticFileCache {
	entries;
	constructor(entries) {
		this.entries = entries;
	}
	/**
	* Scan the client directory and build the cache.
	*
	* Gracefully handles non-existent directories (returns an empty cache).
	*/
	static async create(clientDir) {
		const entries = /* @__PURE__ */ new Map();
		const allFiles = /* @__PURE__ */ new Map();
		for await (const { relativePath, fullPath, stat } of walkFilesWithStats(clientDir)) allFiles.set(relativePath, {
			fullPath,
			size: stat.size,
			mtimeMs: stat.mtimeMs
		});
		for (const [relativePath, fileInfo] of allFiles) {
			if (relativePath.endsWith(".br") || relativePath.endsWith(".gz") || relativePath.endsWith(".zst")) continue;
			if (relativePath.startsWith(".vite/") || relativePath === ".vite") continue;
			const ext = path.extname(relativePath);
			const contentType = CONTENT_TYPES[ext] ?? "application/octet-stream";
			const isHashed = relativePath.startsWith(`_next/static/`) || relativePath.includes(`/_next/static/`);
			const cacheControl = isHashed ? "public, max-age=31536000, immutable" : "public, max-age=3600";
			const etag = isHashed && etagFromFilenameHash(relativePath, ext) || `W/"${fileInfo.size}-${Math.floor(fileInfo.mtimeMs / 1e3)}"`;
			const baseHeaders = {
				"Content-Type": contentType,
				"Cache-Control": cacheControl,
				ETag: etag
			};
			const original = {
				path: fileInfo.fullPath,
				size: fileInfo.size,
				headers: {
					...baseHeaders,
					"Content-Length": String(fileInfo.size)
				}
			};
			const entry = {
				etag,
				notModifiedHeaders: {
					ETag: etag,
					"Cache-Control": cacheControl
				},
				original
			};
			const brInfo = allFiles.get(relativePath + ".br");
			if (brInfo) entry.br = buildVariant(brInfo, baseHeaders, "br");
			const gzInfo = allFiles.get(relativePath + ".gz");
			if (gzInfo) entry.gz = buildVariant(gzInfo, baseHeaders, "gzip");
			const zstInfo = allFiles.get(relativePath + ".zst");
			if (zstInfo) entry.zst = buildVariant(zstInfo, baseHeaders, "zstd");
			if (entry.br || entry.gz || entry.zst) {
				original.headers["Vary"] = "Accept-Encoding";
				entry.notModifiedHeaders["Vary"] = "Accept-Encoding";
			}
			const pathname = "/" + relativePath;
			entries.set(pathname, entry);
			if (ext === ".html") if (relativePath.endsWith("/index.html")) {
				const dirPath = "/" + relativePath.slice(0, -11);
				if (dirPath !== "/") entries.set(dirPath, entry);
			} else {
				const withoutExt = "/" + relativePath.slice(0, -ext.length);
				entries.set(withoutExt, entry);
			}
		}
		const toBuffer = [];
		const seenEntries = /* @__PURE__ */ new Set();
		for (const entry of entries.values()) {
			if (seenEntries.has(entry)) continue;
			seenEntries.add(entry);
			for (const variant of [
				entry.original,
				entry.br,
				entry.gz,
				entry.zst
			]) {
				if (!variant || variant.size > BUFFER_THRESHOLD) continue;
				toBuffer.push(variant);
			}
		}
		for (let i = 0; i < toBuffer.length; i += 64) await Promise.all(toBuffer.slice(i, i + 64).map(async (v) => {
			v.buffer = await fsp.readFile(v.path);
		}));
		return new StaticFileCache(entries);
	}
	/**
	* Look up cached metadata for a URL pathname.
	*
	* Returns undefined if the file is not in the cache. The root path "/"
	* always returns undefined — index.html is served by SSR/RSC.
	*/
	lookup(pathname) {
		if (pathname === "/") return void 0;
		if (pathname.startsWith("/.vite/") || pathname === "/.vite") return void 0;
		return this.entries.get(pathname);
	}
};
/**
* Extract a stable weak ETag from a Vite hashed filename (e.g. `app-DqZc3R4n.js`).
* The hash is a content hash computed by the bundler — deterministic across
* identical builds regardless of filesystem timestamps.
*
* Must be a weak validator (W/) because the same tag is shared across
* content-encoded variants (original, .br, .gz, .zst) which are byte-different.
* Returns null if the filename doesn't contain a recognizable hash suffix,
* so the caller can fall back to mtime-based ETags.
*/
function etagFromFilenameHash(relativePath, ext) {
	const basename = path.basename(relativePath, ext);
	const lastDash = basename.lastIndexOf("-");
	if (lastDash !== -1 && lastDash !== basename.length - 1) {
		const suffix = basename.slice(lastDash + 1);
		if (suffix.length >= 6 && suffix.length <= 12 && /^[A-Za-z0-9_-]+$/.test(suffix)) return `W/"${suffix}"`;
	}
	const normalizedPath = toSlash(relativePath);
	const managedMediaSegment = `${ASSET_PREFIX_URL_DIR}/media/`;
	if (normalizedPath.startsWith(managedMediaSegment) || normalizedPath.includes(`/${managedMediaSegment}`)) {
		const lastDot = basename.lastIndexOf(".");
		if (lastDot !== -1) {
			const suffix = basename.slice(lastDot + 1);
			if (/^[0-9a-f]{8}$/.test(suffix)) return `W/"${suffix}"`;
		}
	}
	return null;
}
function buildVariant(info, baseHeaders, encoding) {
	return {
		path: info.fullPath,
		size: info.size,
		headers: {
			...baseHeaders,
			"Content-Encoding": encoding,
			"Content-Length": String(info.size),
			Vary: "Accept-Encoding"
		}
	};
}
/** Batch size for concurrent stat() calls during directory walk. */
const STAT_BATCH_SIZE = 64;
/**
* Walk a directory recursively, yielding file paths and stats.
*
* Batches stat() calls per directory to avoid sequential syscall overhead
* for large dist/client/ directories.
*/
async function* walkFilesWithStats(dir, base = dir) {
	let entries;
	try {
		entries = await fsp.readdir(dir, { withFileTypes: true });
	} catch {
		return;
	}
	const files = [];
	for (const entry of entries) {
		const fullPath = path.join(dir, entry.name);
		if (entry.isDirectory()) yield* walkFilesWithStats(fullPath, base);
		else if (entry.isFile()) files.push(fullPath);
	}
	for (let i = 0; i < files.length; i += STAT_BATCH_SIZE) {
		const batch = files.slice(i, i + STAT_BATCH_SIZE);
		const stats = await Promise.all(batch.map((f) => fsp.stat(f)));
		for (let j = 0; j < batch.length; j++) yield {
			relativePath: path.relative(base, batch[j]),
			fullPath: batch[j],
			stat: {
				size: stats[j].size,
				mtimeMs: stats[j].mtimeMs
			}
		};
	}
}
//#endregion
export { CONTENT_TYPES, StaticFileCache, etagFromFilenameHash };
