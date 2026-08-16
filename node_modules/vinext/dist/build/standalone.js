import { readJsonFile } from "../utils/safe-json-file.js";
import { resolveVinextPackageRoot } from "../utils/vinext-root.js";
import { createRequire } from "node:module";
import fs from "node:fs";
import nodePath from "node:path";
//#region src/build/standalone.ts
function readPackageJson(packageJsonPath) {
	return JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
}
/** Returns both `dependencies` and `optionalDependencies` keys — the full set of potential runtime deps. */
function runtimeDeps(pkg) {
	return Object.keys({
		...pkg.dependencies,
		...pkg.optionalDependencies
	});
}
/**
* Read the externals manifest written by the `vinext:server-externals-manifest`
* Vite plugin during the production build.
*
* The manifest (`dist/server/vinext-externals.json`) contains the exact set of
* npm packages that the bundler left external in the SSR/RSC output — i.e.
* packages that the server bundle actually imports at runtime. Using this
* instead of scanning emitted files with regexes or seeding from
* `package.json#dependencies` avoids both false negatives (missed imports) and
* false positives (client-only deps that are never loaded server-side).
*
* Falls back to an empty array if the manifest does not exist (e.g. when
* running against a build that predates this feature).
*/
function readServerExternalsManifest(serverDir) {
	const manifestPath = nodePath.join(serverDir, "vinext-externals.json");
	if (!fs.existsSync(manifestPath)) return [];
	return readJsonFile(manifestPath, { onError: (err) => {
		console.warn(`[vinext] Warning: failed to parse ${manifestPath}, proceeding without externals manifest: ${String(err)}`);
	} }) ?? [];
}
function resolvePackageJsonPath(packageName, resolver) {
	try {
		return resolver.resolve(`${packageName}/package.json`);
	} catch {
		const lookupPaths = resolver.resolve.paths(packageName) ?? [];
		for (const lookupPath of lookupPaths) {
			const candidate = nodePath.join(lookupPath, packageName, "package.json");
			if (fs.existsSync(candidate)) {
				if (readPackageJson(candidate).name === packageName) return candidate;
			}
		}
		try {
			const entryPath = resolver.resolve(packageName);
			let dir = nodePath.dirname(entryPath);
			while (dir !== nodePath.dirname(dir)) {
				const candidate = nodePath.join(dir, "package.json");
				if (fs.existsSync(candidate)) {
					if (readPackageJson(candidate).name === packageName) return candidate;
				}
				dir = nodePath.dirname(dir);
			}
		} catch {}
		return null;
	}
}
function copyPackageAndRuntimeDeps(root, targetNodeModulesDir, initialPackages, alreadyCopied) {
	const rootResolver = createRequire(nodePath.join(root, "package.json"));
	const rootPkg = readPackageJson(nodePath.join(root, "package.json"));
	const rootOptional = new Set(Object.keys(rootPkg.optionalDependencies ?? {}));
	const copied = alreadyCopied ?? /* @__PURE__ */ new Set();
	const queue = initialPackages.map((packageName) => ({
		packageName,
		resolver: rootResolver,
		optional: rootOptional.has(packageName)
	}));
	while (queue.length > 0) {
		const entry = queue.shift();
		if (!entry) continue;
		if (copied.has(entry.packageName)) continue;
		const packageJsonPath = resolvePackageJsonPath(entry.packageName, entry.resolver);
		if (!packageJsonPath) {
			if (entry.optional) continue;
			throw new Error(`Failed to resolve required runtime dependency "${entry.packageName}" for standalone output`);
		}
		const realPackageJsonPath = fs.realpathSync(packageJsonPath);
		const packageRoot = nodePath.dirname(realPackageJsonPath);
		const packageTarget = nodePath.join(targetNodeModulesDir, entry.packageName);
		fs.mkdirSync(nodePath.dirname(packageTarget), { recursive: true });
		fs.cpSync(packageRoot, packageTarget, {
			recursive: true,
			dereference: true,
			filter: (src) => {
				return !nodePath.relative(packageRoot, src).split(nodePath.sep).includes("node_modules");
			}
		});
		copied.add(entry.packageName);
		const packageResolver = createRequire(realPackageJsonPath);
		const pkg = readPackageJson(realPackageJsonPath);
		const optionalDeps = new Set(Object.keys(pkg.optionalDependencies ?? {}));
		for (const depName of runtimeDeps(pkg)) if (!copied.has(depName)) queue.push({
			packageName: depName,
			resolver: packageResolver,
			optional: optionalDeps.has(depName)
		});
	}
	return [...copied];
}
function writeStandaloneServerEntry(filePath) {
	fs.writeFileSync(filePath, `#!/usr/bin/env node
import { join } from "node:path";
import { startProdServer } from "vinext/server/prod-server";

const port = Number.parseInt(process.env.PORT ?? "3000", 10);
const host = process.env.HOST ?? "0.0.0.0";

startProdServer({
  port,
  host,
  outDir: join(import.meta.dirname, "dist"),
}).catch((error) => {
  console.error("[vinext] Failed to start standalone server");
  console.error(error);
  process.exit(1);
});
`, "utf-8");
	fs.chmodSync(filePath, 493);
}
function writeStandalonePackageJson(filePath) {
	fs.writeFileSync(filePath, JSON.stringify({
		private: true,
		type: "module"
	}, null, 2) + "\n", "utf-8");
}
/**
* Emit standalone production output for self-hosted deployments.
*
* Creates:
* - <outDir>/standalone/server.js
* - <outDir>/standalone/dist/{client,server}
* - <outDir>/standalone/node_modules (runtime deps only)
*
* The set of packages copied into node_modules/ is determined by
* `dist/server/vinext-externals.json`, which is written by the
* `vinext:server-externals-manifest` Vite plugin during the production build.
* It contains exactly the packages the server bundle imports at runtime
* (i.e. those left external by the bundler), so no client-only deps are
* included.
*/
function emitStandaloneOutput(options) {
	const root = nodePath.resolve(options.root);
	const outDir = nodePath.resolve(options.outDir);
	const clientDir = nodePath.join(outDir, "client");
	const serverDir = nodePath.join(outDir, "server");
	if (!fs.existsSync(clientDir) || !fs.existsSync(serverDir)) throw new Error(`No build output found in ${outDir}. Run vinext build first.`);
	const standaloneDir = nodePath.join(outDir, "standalone");
	const standaloneDistDir = nodePath.join(standaloneDir, "dist");
	const standaloneNodeModulesDir = nodePath.join(standaloneDir, "node_modules");
	fs.rmSync(standaloneDir, {
		recursive: true,
		force: true
	});
	fs.mkdirSync(standaloneDistDir, { recursive: true });
	fs.cpSync(clientDir, nodePath.join(standaloneDistDir, "client"), {
		recursive: true,
		dereference: true,
		filter: (src) => !nodePath.relative(clientDir, src).split(nodePath.sep).includes("node_modules")
	});
	fs.cpSync(serverDir, nodePath.join(standaloneDistDir, "server"), {
		recursive: true,
		dereference: true,
		filter: (src) => !nodePath.relative(serverDir, src).split(nodePath.sep).includes("node_modules")
	});
	const clientAssetsSidecar = nodePath.join(outDir, "vinext-client-assets.js");
	if (fs.existsSync(clientAssetsSidecar)) fs.copyFileSync(clientAssetsSidecar, nodePath.join(standaloneDistDir, "vinext-client-assets.js"));
	const publicDir = nodePath.join(root, "public");
	if (fs.existsSync(publicDir)) fs.cpSync(publicDir, nodePath.join(standaloneDir, "public"), {
		recursive: true,
		dereference: true,
		filter: (src) => !nodePath.relative(publicDir, src).split(nodePath.sep).includes("node_modules")
	});
	fs.mkdirSync(standaloneNodeModulesDir, { recursive: true });
	const initialPackages = readServerExternalsManifest(serverDir).filter((name) => name !== "vinext");
	const copiedSet = /* @__PURE__ */ new Set();
	copyPackageAndRuntimeDeps(root, standaloneNodeModulesDir, initialPackages, copiedSet);
	const vinextPackageRoot = resolveVinextPackageRoot(options.vinextPackageRoot);
	const vinextDistDir = nodePath.join(vinextPackageRoot, "dist");
	if (!fs.existsSync(vinextDistDir)) throw new Error(`vinext runtime dist/ not found at ${vinextPackageRoot}`);
	const vinextTargetDir = nodePath.join(standaloneNodeModulesDir, "vinext");
	fs.mkdirSync(vinextTargetDir, { recursive: true });
	fs.copyFileSync(nodePath.join(vinextPackageRoot, "package.json"), nodePath.join(vinextTargetDir, "package.json"));
	fs.cpSync(vinextDistDir, nodePath.join(vinextTargetDir, "dist"), {
		recursive: true,
		dereference: true,
		filter: (src) => {
			return !nodePath.relative(vinextDistDir, src).split(nodePath.sep).includes("node_modules");
		}
	});
	copiedSet.add("vinext");
	copyPackageAndRuntimeDeps(vinextPackageRoot, standaloneNodeModulesDir, runtimeDeps(readPackageJson(nodePath.join(vinextPackageRoot, "package.json"))).filter((name) => !copiedSet.has(name)), copiedSet);
	writeStandaloneServerEntry(nodePath.join(standaloneDir, "server.js"));
	writeStandalonePackageJson(nodePath.join(standaloneDir, "package.json"));
	return {
		standaloneDir,
		copiedPackages: [...copiedSet]
	};
}
//#endregion
export { emitStandaloneOutput };
