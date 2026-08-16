import { isUnknownRecord } from "../utils/record.js";
import { readFile } from "node:fs/promises";
//#region src/plugins/client-reference-dedup.ts
function defaultReadPackageJson(path) {
	return readFile(path, "utf8");
}
function parsePackagePath(absolutePath) {
	const lastIdx = absolutePath.lastIndexOf("/node_modules/");
	if (lastIdx === -1) return null;
	const rest = absolutePath.slice(lastIdx + 14);
	const parts = rest.split("/");
	const packagePartCount = rest.startsWith("@") ? 2 : 1;
	const packageParts = parts.slice(0, packagePartCount);
	if (packageParts.length < packagePartCount || packageParts.some((part) => part === "")) return null;
	const packageName = packageParts.join("/");
	const relativeParts = parts.slice(packagePartCount);
	return {
		packageName,
		packageRoot: absolutePath.slice(0, lastIdx + 14 + packageName.length),
		relativePath: relativeParts.join("/")
	};
}
/**
* Extract the bare package name from an absolute file path containing node_modules.
*
* Handles scoped packages (`@org/name`) and nested node_modules.
* Returns `null` if the path doesn't contain `/node_modules/`.
*/
function extractPackageName(absolutePath) {
	return parsePackagePath(absolutePath)?.packageName ?? null;
}
function normalizeExportTarget(target) {
	return target.startsWith("./") ? target.slice(2) : target;
}
function matchExportTarget(target, relativePath) {
	const normalizedTarget = normalizeExportTarget(target);
	const wildcardIndex = normalizedTarget.indexOf("*");
	if (wildcardIndex === -1) return normalizedTarget === relativePath ? "" : null;
	const beforeWildcard = normalizedTarget.slice(0, wildcardIndex);
	const afterWildcard = normalizedTarget.slice(wildcardIndex + 1);
	if (!relativePath.startsWith(beforeWildcard) || !relativePath.endsWith(afterWildcard)) return null;
	return relativePath.slice(beforeWildcard.length, relativePath.length - afterWildcard.length);
}
function exportKeyToSpecifier(packageName, exportKey, wildcardMatch) {
	if (exportKey === ".") return packageName;
	const subpath = exportKey.startsWith("./") ? exportKey.slice(2) : exportKey;
	return `${packageName}/${subpath.includes("*") ? subpath.replace("*", wildcardMatch) : subpath}`;
}
function collectExportTargets(value) {
	if (typeof value === "string") return [value];
	if (Array.isArray(value)) return value.flatMap((entry) => collectExportTargets(entry));
	if (!isUnknownRecord(value)) return [];
	return Object.values(value).flatMap((entry) => collectExportTargets(entry));
}
function findExportSpecifier(packageName, exportsValue, relativePath) {
	if (!isUnknownRecord(exportsValue)) {
		for (const target of collectExportTargets(exportsValue)) {
			const wildcardMatch = matchExportTarget(target, relativePath);
			if (wildcardMatch !== null) return exportKeyToSpecifier(packageName, ".", wildcardMatch);
		}
		return null;
	}
	const entries = Object.entries(exportsValue);
	if (!entries.some(([key]) => key === "." || key.startsWith("./"))) {
		for (const target of collectExportTargets(exportsValue)) {
			const wildcardMatch = matchExportTarget(target, relativePath);
			if (wildcardMatch !== null) return exportKeyToSpecifier(packageName, ".", wildcardMatch);
		}
		return null;
	}
	let bestMatch = null;
	for (const [key, value] of entries) {
		if (key !== "." && !key.startsWith("./")) continue;
		for (const target of collectExportTargets(value)) {
			const wildcardMatch = matchExportTarget(target, relativePath);
			if (wildcardMatch === null) continue;
			if (!bestMatch || key.length > bestMatch.key.length) bestMatch = {
				key,
				wildcard: wildcardMatch
			};
		}
	}
	return bestMatch ? exportKeyToSpecifier(packageName, bestMatch.key, bestMatch.wildcard) : null;
}
function getLegacyEntry(packageJson) {
	const browser = packageJson.browser;
	if (typeof browser === "string") return browser;
	const module = packageJson.module;
	if (typeof module === "string") return module;
	const main = packageJson.main;
	return typeof main === "string" ? main : "index.js";
}
function matchesLegacyEntry(legacyEntry, relativePath) {
	const normalizedEntry = normalizeExportTarget(legacyEntry);
	return normalizedEntry === relativePath || `${normalizedEntry}.js` === relativePath;
}
/**
* Convert an absolute package file path into the least lossy bare import
* specifier that can be handed back to Vite's dependency optimizer.
*/
async function extractPackageImportSpecifier(absolutePath, readPackageJson = defaultReadPackageJson) {
	const packagePath = parsePackagePath(absolutePath);
	if (!packagePath) return null;
	const { packageName, packageRoot, relativePath } = packagePath;
	if (relativePath === "") return {
		packageName,
		specifier: packageName
	};
	let packageJson = null;
	try {
		const rawPackageJson = await readPackageJson(`${packageRoot}/package.json`);
		const parsedPackageJson = JSON.parse(rawPackageJson);
		packageJson = isUnknownRecord(parsedPackageJson) ? parsedPackageJson : null;
	} catch {
		packageJson = null;
	}
	if (!packageJson) return {
		packageName,
		specifier: packageName
	};
	if ("exports" in packageJson) return {
		packageName,
		specifier: findExportSpecifier(packageName, packageJson.exports, relativePath) ?? packageName
	};
	return {
		packageName,
		specifier: matchesLegacyEntry(getLegacyEntry(packageJson), relativePath) ? packageName : `${packageName}/${relativePath}`
	};
}
const DEDUP_PREFIX = "\0vinext:dedup/";
const DEDUP_FILTER = /^\0vinext:dedup\//;
const PROXY_MARKER = "virtual:vite-rsc/client-in-server-package-proxy/";
/**
* Intercepts absolute node_modules path imports originating from RSC
* `client-in-server-package-proxy` virtual modules in the client environment
* and redirects them through bare specifier imports. This ensures the browser
* loads the pre-bundled version (from `.vite/deps/`) rather than the raw ESM
* file, preventing module duplication and broken React contexts.
*
* Dev-only — production builds use the SSR manifest which handles this correctly.
*/
function clientReferenceDedupPlugin(options = {}) {
	let excludeSet = /* @__PURE__ */ new Set();
	const readPackageJson = options.readFile ?? defaultReadPackageJson;
	const packageImportCache = /* @__PURE__ */ new Map();
	return {
		name: "vinext:client-reference-dedup",
		enforce: "pre",
		apply: "serve",
		configResolved(config) {
			const clientExclude = config.environments?.client?.optimizeDeps?.exclude ?? config.optimizeDeps?.exclude ?? [];
			excludeSet = new Set(clientExclude);
		},
		resolveId: {
			filter: { id: /node_modules/ },
			async handler(id, importer) {
				if (this.environment?.name !== "client") return;
				if (!importer || !importer.includes(PROXY_MARKER)) return;
				if (!id.startsWith("/") || !id.includes("/node_modules/")) return;
				const packageName = extractPackageName(id);
				if (!packageName) return;
				if (excludeSet.has(packageName)) return;
				let packageImportPromise = packageImportCache.get(id);
				if (!packageImportPromise) {
					packageImportPromise = extractPackageImportSpecifier(id, readPackageJson);
					packageImportCache.set(id, packageImportPromise);
				}
				const packageImport = await packageImportPromise;
				if (!packageImport) return;
				if (excludeSet.has(packageImport.specifier)) return;
				return `${DEDUP_PREFIX}${packageImport.specifier}`;
			}
		},
		load: {
			filter: { id: DEDUP_FILTER },
			handler(id) {
				if (!id.startsWith(DEDUP_PREFIX)) return;
				const pkgName = id.slice(14);
				return [
					`export * from ${JSON.stringify(pkgName)};`,
					`import * as __all__ from ${JSON.stringify(pkgName)};`,
					`export default __all__.default;`
				].join("\n");
			}
		}
	};
}
//#endregion
export { clientReferenceDedupPlugin, extractPackageImportSpecifier, extractPackageName };
