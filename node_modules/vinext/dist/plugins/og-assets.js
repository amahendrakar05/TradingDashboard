import path from "../deps/.pnpm/pathslash@0.1.0/deps/pathslash/dist/index.js";
import { OgAssetOwnership } from "./og-asset-ownership.js";
import { createRequire } from "node:module";
import fs from "node:fs";
import MagicString from "magic-string";
//#region src/plugins/og-assets.ts
/**
* Create the `vinext:og-inline-fetch-assets` Vite plugin.
*
* Inlines binary assets that are runtime-fetched via
* `fetch(new URL("./asset", import.meta.url))` or read via
* `readFileSync(fileURLToPath(new URL("./asset", import.meta.url)))`.
* Both patterns are rewritten to inline base64 literals so the code works
* correctly inside Cloudflare Workers where `import.meta.url` is not a
* valid file URL.
*/
function createOgInlineFetchAssetsPlugin() {
	const cache = /* @__PURE__ */ new Map();
	const ownership = new OgAssetOwnership();
	let isBuild = false;
	return {
		name: "vinext:og-inline-fetch-assets",
		enforce: "pre",
		configResolved(config) {
			isBuild = config.command === "build";
			ownership.configure(config.root, config.resolve.alias);
		},
		buildStart() {
			if (isBuild) cache.clear();
			ownership.reset();
		},
		async resolveId(source, importer, options) {
			if (!ownership.shouldTrackImport(source)) return null;
			const resolved = await this.resolve(source, importer, {
				...options,
				skipSelf: true
			});
			if (resolved === null || resolved.external) return null;
			await ownership.recordResolvedImport(source, resolved.id);
			return null;
		},
		transform: {
			filter: { code: "import.meta.url" },
			async handler(code, id) {
				const useCache = isBuild;
				const boundary = await ownership.resolveModuleBoundary(id);
				if (boundary === null) return null;
				const { assetRoot, moduleDir } = boundary;
				const s = new MagicString(code);
				let didReplace = false;
				const readAsBase64 = async (absPath) => {
					const realPath = await ownership.resolveContainedAsset(assetRoot, absPath);
					if (realPath === null) return null;
					const cached = useCache ? cache.get(realPath) : void 0;
					if (cached !== void 0) return cached;
					try {
						const b64 = (await fs.promises.readFile(realPath)).toString("base64");
						if (useCache) cache.set(realPath, b64);
						return b64;
					} catch {
						return null;
					}
				};
				if (code.includes("fetch(")) for (const match of code.matchAll(/fetch\(\s*new URL\(\s*(["'])(\.[^"']+)\1\s*,\s*import\.meta\.url\s*\)\s*\)(?:\.then\(\s*(?:function\s*\([^)]*\)|\([^)]*\)\s*=>)\s*\{?\s*return\s+[^.]+\.arrayBuffer\(\)\s*;?\s*\}?\s*,?\s*\)|\.then\(\s*\([^)]*\)\s*=>\s*[^.]+\.arrayBuffer\(\)\s*,?\s*\))/g)) {
					const fullMatch = match[0];
					const relPath = match[2];
					const fileBase64 = await readAsBase64(path.resolve(moduleDir, relPath));
					if (fileBase64 === null) continue;
					const inlined = [
						`(function(){`,
						`var b=${JSON.stringify(fileBase64)};`,
						`var r=atob(b);`,
						`var a=new Uint8Array(r.length);`,
						`for(var i=0;i<r.length;i++)a[i]=r.charCodeAt(i);`,
						`return Promise.resolve(a.buffer);`,
						`})()`
					].join("");
					s.overwrite(match.index, match.index + fullMatch.length, inlined);
					didReplace = true;
				}
				if (code.includes("readFileSync(")) for (const match of code.matchAll(/[a-zA-Z_$][a-zA-Z0-9_$]*\.readFileSync\(\s*(?:[a-zA-Z_$][a-zA-Z0-9_$]*\.)?fileURLToPath\(\s*new URL\(\s*(["'])(\.[^"']+)\1\s*,\s*import\.meta\.url\s*\)\s*\)\s*\)/g)) {
					const fullMatch = match[0];
					const relPath = match[2];
					const fileBase64 = await readAsBase64(path.resolve(moduleDir, relPath));
					if (fileBase64 === null) continue;
					const inlined = `Buffer.from(${JSON.stringify(fileBase64)},"base64")`;
					s.overwrite(match.index, match.index + fullMatch.length, inlined);
					didReplace = true;
				}
				if (!didReplace) return null;
				return {
					code: s.toString(),
					map: s.generateMap({ hires: "boundary" })
				};
			}
		}
	};
}
const OG_WASM_ASSETS = ["resvg.wasm", "yoga.wasm"];
/**
* Find an emitted WASM asset in the output bundle whose name corresponds to the
* given base file (e.g. base `resvg.wasm` matches the emitted `resvg-HASH.wasm`).
*
* The bundler emits the `import("./resvg.wasm?module")` dynamic import as a
* hashed asset. When it exists, both loader strategies can point at the same
* physical file — no second copy needed.
*
* @returns the emitted asset's `fileName` (relative to outDir), or null.
*/
function findEmittedWasmAsset(bundle, baseName) {
	const stem = baseName.replace(/\.wasm$/, "");
	const re = new RegExp(`^${stem}(?:[-.][\\w-]+)?\\.wasm$`);
	for (const output of Object.values(bundle)) {
		if (output.type !== "asset") continue;
		if (re.test(path.basename(output.fileName))) return output.fileName;
	}
	return null;
}
/**
* Build the regex that matches the Node.js fallback reference
* `new URL("./<base>", import.meta.url)` for a given WASM base name.
*
* Handles all three quote styles ("'`) because the minifier may rewrite the
* string literal (commonly to a template literal) by the time the chunk code
* is available in generateBundle.
*/
function fallbackUrlRegex(baseName) {
	const escaped = baseName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	return new RegExp(String.raw`new URL\(\s*(["'\`])\.\/${escaped}\1\s*,\s*import\.meta\.url\s*\)`, "g");
}
/**
* Copy a single root copy of each requested WASM asset from `sourceDir` into
* `outDir`, skipping any asset whose source is missing or whose destination
* already exists.
*
* Extracted as a pure, dependency-injected helper so it can be unit-tested
* against a temp source directory without depending on the real @vercel/og
* install (whose `yoga.wasm` is only materialized as a side effect of the
* `vinext:og-font-patch` transform during a build).
*/
function copyMissingOgWasm(opts) {
	for (const asset of opts.assets) {
		const src = path.join(opts.sourceDir, asset);
		const dest = path.join(opts.outDir, asset);
		if (fs.existsSync(src) && !fs.existsSync(dest)) fs.copyFileSync(src, dest);
	}
}
/**
* Create the `vinext:og-assets` Vite plugin.
*
* Ensures each @vercel/og WASM module (resvg.wasm, yoga.wasm) ships exactly once
* in the RSC output, with every loader strategy resolving to that single file:
*
*   1. `generateBundle` (post): if the bundler already emitted the WASM as a
*      hashed asset (from the `import("./x.wasm?module")` path), rewrite the
*      Node.js fallback reference `new URL("./x.wasm", import.meta.url)` in each
*      chunk to point at that emitted asset (a sibling under `_next/static/`).
*      This deduplicates without copying a second root file.
*   2. `writeBundle` (post): for any referenced WASM that was NOT emitted as an
*      asset (e.g. a build that inlined or skipped it), copy a single root copy
*      from @vercel/og's dist so the Node.js disk-read fallback still works.
*
* The decision keys off "did the bundler emit this asset?", never the deploy
* target — so it helps Node/self-hosted builds as well as Cloudflare Workers.
*/
function createOgAssetsPlugin() {
	let dedupedBases = /* @__PURE__ */ new Set();
	return {
		name: "vinext:og-assets",
		apply: "build",
		enforce: "post",
		generateBundle: {
			order: "post",
			handler(_options, bundle) {
				if (this.environment?.name !== "rsc") return;
				dedupedBases = /* @__PURE__ */ new Set();
				const chunks = Object.values(bundle).filter((o) => o.type === "chunk");
				for (const base of OG_WASM_ASSETS) {
					if (!chunks.some((c) => c.code.includes(base))) continue;
					const emitted = findEmittedWasmAsset(bundle, base);
					if (!emitted) continue;
					for (const chunk of chunks) {
						const re = fallbackUrlRegex(base);
						const chunkDir = path.dirname(chunk.fileName);
						const rel = path.relative(chunkDir, emitted);
						const ref = rel.startsWith(".") ? rel : `./${rel}`;
						const s = new MagicString(chunk.code);
						let edited = false;
						for (const m of chunk.code.matchAll(re)) {
							const quote = m[1];
							const start = m.index;
							s.overwrite(start, start + m[0].length, `new URL(${quote}${ref}${quote}, import.meta.url)`);
							edited = true;
						}
						if (!edited) continue;
						chunk.code = s.toString();
						if (chunk.map) chunk.map = s.generateMap({
							hires: "boundary",
							source: chunk.fileName
						});
					}
					dedupedBases.add(base);
				}
			}
		},
		writeBundle: {
			sequential: true,
			order: "post",
			async handler(options, bundle) {
				if (this.environment?.name !== "rsc") return;
				const outDir = options.dir;
				if (!outDir) return;
				const chunkCode = Object.values(bundle).map((output) => output.type === "chunk" ? output.code : "").join("\n");
				const referencedAssets = OG_WASM_ASSETS.filter((asset) => chunkCode.includes(asset) && !dedupedBases.has(asset));
				if (referencedAssets.length === 0) return;
				try {
					const ogPkgPath = createRequire(import.meta.url).resolve("@vercel/og/package.json");
					copyMissingOgWasm({
						outDir,
						sourceDir: path.join(path.dirname(ogPkgPath), "dist"),
						assets: referencedAssets
					});
				} catch {}
			}
		}
	};
}
//#endregion
export { copyMissingOgWasm, createOgAssetsPlugin, createOgInlineFetchAssetsPlugin };
