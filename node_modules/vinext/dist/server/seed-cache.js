import path from "../deps/.pnpm/pathslash@0.1.0/deps/pathslash/dist/index.js";
import { isrCacheKey, isrSetPrerenderedAppPage } from "./isr-cache.js";
import { getRenderedAppRoutes, isFallbackShellArtifactPath, readPrerenderManifest } from "./prerender-manifest.js";
import { buildAppPageCacheTags } from "./app-page-cache.js";
import { getOutputPath, getRscOutputPath } from "../utils/prerender-output-paths.js";
import { addPregeneratedConcretePath, clearPregeneratedConcretePaths, normalizePregeneratedPathname } from "./pregenerated-concrete-paths.js";
import fs from "node:fs";
//#region src/server/seed-cache.ts
/**
* Seed the memory cache from pre-rendered build output.
*
* Reads `vinext-prerender.json` and the corresponding HTML/RSC files from
* `dist/server/prerendered-routes/`, then populates the active CacheHandler
* so pre-rendered pages are served as cache HITs on the very first request
* instead of triggering a full re-render.
*
* This is only useful for the MemoryCacheHandler (the default for Node.js
* production). Persistent backends like KV already retain entries across
* deploys and can be pre-populated via TPR or similar mechanisms.
*
* Consistency model:
* - The manifest is authoritative for which routes were pre-rendered and their
*   revalidation config. The HTML/RSC files on disk are the source of truth
*   for content. Both are produced by the same build and are immutable after
*   the build completes.
* - Cache keys include the buildId, so entries from a previous build are never
*   matched by a new server process (new build = new buildId = new keys).
* - Seeded entries are indistinguishable from entries created by the ISR
*   render path: same cache value shape, same revalidate duration tracking,
*   same cache key construction. The serving path does not know or care
*   whether an entry was seeded or rendered.
*
* Concurrency model:
* - This function runs at startup before the HTTP server begins accepting
*   requests, so there are no concurrent readers during seeding. All I/O is
*   synchronous (readFileSync) which is appropriate for a startup-only path
*   that runs once before the event loop serves traffic.
*/
/**
* Read pre-rendered routes from disk and seed the active CacheHandler.
*
* Call this during production server startup, before any requests are served.
* If the manifest doesn't exist (no prerender phase was run), this is a no-op.
*
* @param serverDir - Path to `dist/server/` (where vinext-prerender.json lives)
* @returns The number of routes seeded (0 if no manifest or no renderable routes).
*/
async function seedMemoryCacheFromPrerender(serverDir, options) {
	clearPregeneratedConcretePaths();
	const manifest = readPrerenderManifest(path.join(serverDir, "vinext-prerender.json"));
	if (!manifest) return 0;
	const { buildId, routes } = manifest;
	if (!buildId || !Array.isArray(routes)) return 0;
	const trailingSlash = manifest.trailingSlash ?? false;
	const prerenderDir = path.join(serverDir, "prerendered-routes");
	const writeAppPageEntry = options?.writeAppPageEntry ?? createDefaultAppPageEntryWriter();
	let seeded = 0;
	const appRoutes = getRenderedAppRoutes(routes);
	for (const route of appRoutes) {
		const concretePathname = route.path ?? route.route;
		if (!isFallbackShellArtifactPath(concretePathname, route)) addPregeneratedConcretePath(route.route, concretePathname);
		const artifactPathname = route.path ?? route.route;
		const cachePathname = normalizePregeneratedPathname(artifactPathname);
		const baseKey = isrCacheKey("app", cachePathname, buildId);
		const htmlKey = options?.buildAppPageHtmlKey?.(cachePathname) ?? baseKey + ":html";
		const rscKey = options?.buildAppPageRscKey?.(cachePathname) ?? baseKey + ":rsc";
		const revalidateSeconds = typeof route.revalidate === "number" ? route.revalidate : void 0;
		const expireSeconds = typeof route.expire === "number" ? route.expire : void 0;
		const tags = buildAppPageCacheTags(cachePathname, []);
		if (await seedHtml(writeAppPageEntry, prerenderDir, htmlKey, artifactPathname, trailingSlash, route.headers, revalidateSeconds, expireSeconds, tags)) {
			await seedRsc(writeAppPageEntry, prerenderDir, rscKey, artifactPathname, revalidateSeconds, expireSeconds, tags);
			seeded++;
		}
	}
	return seeded;
}
function createDefaultAppPageEntryWriter() {
	return (key, data, metadata) => isrSetPrerenderedAppPage(key, data, metadata);
}
/**
* Seed the HTML cache entry for a single route.
* Returns true if the file existed and was seeded.
*/
async function seedHtml(writeAppPageEntry, prerenderDir, key, pathname, trailingSlash, headers, revalidateSeconds, expireSeconds, tags) {
	const relPath = getOutputPath(pathname, trailingSlash);
	const fullPath = path.join(prerenderDir, relPath);
	if (!fs.existsSync(fullPath)) return false;
	await writeAppPageEntry(key, {
		kind: "APP_PAGE",
		html: fs.readFileSync(fullPath, "utf-8"),
		rscData: void 0,
		headers,
		postponed: void 0,
		status: void 0
	}, {
		expireSeconds,
		revalidateSeconds,
		tags
	});
	return true;
}
/**
* Seed the RSC cache entry for a single route.
* No-op if the .rsc file doesn't exist on disk.
*/
async function seedRsc(writeAppPageEntry, prerenderDir, key, pathname, revalidateSeconds, expireSeconds, tags) {
	const relPath = getRscOutputPath(pathname);
	const fullPath = path.join(prerenderDir, relPath);
	if (!fs.existsSync(fullPath)) return;
	const rscBuffer = fs.readFileSync(fullPath);
	await writeAppPageEntry(key, {
		kind: "APP_PAGE",
		html: "",
		rscData: rscBuffer.buffer.slice(rscBuffer.byteOffset, rscBuffer.byteOffset + rscBuffer.byteLength),
		headers: void 0,
		postponed: void 0,
		status: void 0
	}, {
		expireSeconds,
		revalidateSeconds,
		tags
	});
}
//#endregion
export { seedMemoryCacheFromPrerender };
