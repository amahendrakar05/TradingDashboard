import path, { toSlash } from "../deps/.pnpm/pathslash@0.1.0/deps/pathslash/dist/index.js";
import fs from "node:fs";
import { promisify } from "node:util";
//#region src/plugins/og-asset-ownership.ts
const promisifiedRealpathNative = promisify(fs.realpath.native);
const realpathNative = async (target) => toSlash(await promisifiedRealpathNative(target));
function isPathInside(root, target) {
	const relative = path.relative(root, target);
	return relative === "" || !path.isAbsolute(relative) && !relative.startsWith("../") && relative !== "..";
}
async function findPackageRoot(moduleDir, expectedPackageName) {
	let currentDir = moduleDir;
	while (true) {
		try {
			const packageJsonPath = path.join(currentDir, "package.json");
			if ((await fs.promises.stat(packageJsonPath)).isFile()) {
				const manifest = JSON.parse(await fs.promises.readFile(packageJsonPath, "utf8"));
				return expectedPackageName === void 0 || manifest.name === expectedPackageName ? currentDir : null;
			}
		} catch {}
		const parentDir = path.dirname(currentDir);
		if (parentDir === currentDir) return null;
		currentDir = parentDir;
	}
}
function getPackageNameFromSpecifier(specifier) {
	if (specifier.startsWith(".") || specifier.startsWith("/") || specifier.startsWith("\0") || specifier.startsWith("#")) return null;
	const segments = specifier.split("/");
	if (specifier.startsWith("@")) return segments.length >= 2 ? `${segments[0]}/${segments[1]}` : null;
	return segments[0] || null;
}
function getAliasedPackageName(value) {
	if (typeof value !== "string") return null;
	return value.match(/^(?:npm:|workspace:)(@[^/]+\/[^@]+|[^@*~^]+)(?:@|$)/)?.[1] ?? null;
}
function aliasMatches(find, source) {
	if (typeof find === "string") return source === find || source.startsWith(`${find}/`);
	find.lastIndex = 0;
	return find.test(source);
}
function applyAlias(find, replacement, source) {
	if (typeof find === "string") return replacement + source.slice(find.length);
	find.lastIndex = 0;
	return source.replace(find, replacement);
}
function getNodeModulesPackageRoot(logicalProjectRoot, logicalModulePath) {
	const isProjectPath = isPathInside(logicalProjectRoot, logicalModulePath);
	const parsedPath = path.parse(logicalModulePath);
	const baseRoot = isProjectPath ? logicalProjectRoot : parsedPath.root;
	const segments = (isProjectPath ? path.relative(logicalProjectRoot, logicalModulePath) : logicalModulePath.slice(parsedPath.root.length)).split("/");
	const nodeModulesIndex = segments.lastIndexOf("node_modules");
	if (nodeModulesIndex === -1) return null;
	const packageSegment = segments[nodeModulesIndex + 1];
	if (!packageSegment) return null;
	const packageSegmentCount = packageSegment.startsWith("@") ? 2 : 1;
	if (segments.length <= nodeModulesIndex + packageSegmentCount) return null;
	if (packageSegmentCount === 2 && !segments[nodeModulesIndex + 2]) return null;
	return path.join(baseRoot, ...segments.slice(0, nodeModulesIndex + 1 + packageSegmentCount));
}
async function readPackageName(packageRoot) {
	try {
		const manifest = JSON.parse(await fs.promises.readFile(path.join(packageRoot, "package.json"), "utf8"));
		return typeof manifest.name === "string" ? manifest.name : null;
	} catch {
		return null;
	}
}
async function packageOwnsAliasFile(packageRoot, packageName, aliasFile) {
	try {
		const manifest = JSON.parse(await fs.promises.readFile(path.join(packageRoot, "package.json"), "utf8"));
		if (packageName !== null && manifest.name === packageName) return true;
		return [
			"main",
			"module",
			"source",
			"browser"
		].some((field) => typeof manifest[field] === "string" && path.resolve(packageRoot, manifest[field]) === aliasFile);
	} catch {
		return false;
	}
}
async function packageOwnsAliasDirectory(packageRoot, packageName, aliasDirectory) {
	if (aliasDirectory === packageRoot) return true;
	try {
		const manifest = JSON.parse(await fs.promises.readFile(path.join(packageRoot, "package.json"), "utf8"));
		if (packageName !== null && manifest.name === packageName) return true;
		return [
			"main",
			"module",
			"source",
			"browser"
		].some((field) => typeof manifest[field] === "string" && isPathInside(aliasDirectory, path.resolve(packageRoot, manifest[field])));
	} catch {
		return false;
	}
}
var OgAssetOwnership = class {
	projectRoot = toSlash(process.cwd());
	linkedPackageRoots = /* @__PURE__ */ new Set();
	dependencyPackageNames = /* @__PURE__ */ new Map();
	stringAliasesByFirstCharacter = /* @__PURE__ */ new Map();
	regularExpressionAliases = [];
	configuredAliases = [];
	configure(projectRoot, aliases) {
		this.projectRoot = path.resolve(projectRoot);
		this.dependencyPackageNames.clear();
		try {
			const manifest = JSON.parse(fs.readFileSync(path.join(this.projectRoot, "package.json"), "utf8"));
			for (const field of [
				"dependencies",
				"devDependencies",
				"optionalDependencies",
				"peerDependencies"
			]) {
				const dependencies = manifest[field];
				if (dependencies === null || typeof dependencies !== "object") continue;
				for (const [packageName, value] of Object.entries(dependencies)) this.dependencyPackageNames.set(packageName, getAliasedPackageName(value) ?? packageName);
			}
		} catch {}
		this.stringAliasesByFirstCharacter.clear();
		this.regularExpressionAliases = [];
		this.configuredAliases = [];
		for (const [index, alias] of aliases.entries()) {
			const indexedAlias = {
				...alias,
				index
			};
			this.configuredAliases.push(indexedAlias);
			if (typeof alias.find === "string") {
				const firstCharacter = alias.find[0];
				if (firstCharacter === void 0) continue;
				const matchingAliases = this.stringAliasesByFirstCharacter.get(firstCharacter) ?? [];
				matchingAliases.push(indexedAlias);
				this.stringAliasesByFirstCharacter.set(firstCharacter, matchingAliases);
			} else this.regularExpressionAliases.push(indexedAlias);
		}
	}
	reset() {
		this.linkedPackageRoots.clear();
	}
	shouldTrackImport(source) {
		return this.findAlias(source) !== void 0 || this.getExpectedPackageName(source) !== void 0;
	}
	async recordResolvedImport(source, resolvedId) {
		const configuredAlias = this.findAlias(source);
		const sourcePackageName = getPackageNameFromSpecifier(source);
		const expectedPackageName = this.getExpectedPackageName(source);
		if (configuredAlias === void 0 && expectedPackageName === void 0) return;
		let realResolvedPath;
		try {
			realResolvedPath = await realpathNative(path.resolve(resolvedId.split("?")[0]));
		} catch {
			return;
		}
		let packageRoot;
		if (configuredAlias !== void 0) packageRoot = await this.resolveAliasPackageRoot(configuredAlias, source, sourcePackageName, realResolvedPath);
		else packageRoot = await findPackageRoot(path.dirname(realResolvedPath), expectedPackageName);
		if (packageRoot !== null) this.linkedPackageRoots.add(packageRoot);
	}
	async resolveModuleBoundary(moduleId) {
		const modulePath = path.resolve(moduleId.split("?")[0]);
		let realProjectRoot;
		let realModulePath;
		try {
			[realProjectRoot, realModulePath] = await Promise.all([realpathNative(this.projectRoot), realpathNative(modulePath)]);
		} catch {
			try {
				realProjectRoot = await realpathNative(this.projectRoot);
				const realModuleDir = await realpathNative(path.dirname(modulePath));
				realModulePath = path.join(realModuleDir, path.basename(modulePath));
			} catch {
				return null;
			}
		}
		const moduleDir = path.dirname(realModulePath);
		const logicalPackageRoot = getNodeModulesPackageRoot(this.projectRoot, modulePath);
		if (logicalPackageRoot !== null) {
			let realPackageRoot;
			try {
				realPackageRoot = await realpathNative(logicalPackageRoot);
			} catch {
				return null;
			}
			if (isPathInside(realPackageRoot, realModulePath)) return {
				assetRoot: realPackageRoot,
				moduleDir
			};
			const declaredPackageName = await readPackageName(logicalPackageRoot);
			if (declaredPackageName === null) return null;
			const logicalModuleRelativePath = path.relative(logicalPackageRoot, modulePath);
			if (path.isAbsolute(logicalModuleRelativePath) || logicalModuleRelativePath === ".." || logicalModuleRelativePath.startsWith("../")) return null;
			const canonicalPackageRoot = await findPackageRoot(moduleDir, declaredPackageName);
			if (canonicalPackageRoot === null) return null;
			if (path.relative(canonicalPackageRoot, realModulePath) !== logicalModuleRelativePath) return null;
			return {
				assetRoot: canonicalPackageRoot,
				moduleDir
			};
		}
		if (isPathInside(realProjectRoot, realModulePath)) return {
			assetRoot: realProjectRoot,
			moduleDir
		};
		const linkedPackageRoot = [...this.linkedPackageRoots].filter((root) => isPathInside(root, realModulePath)).sort((a, b) => b.length - a.length)[0];
		if (linkedPackageRoot !== void 0) return {
			assetRoot: linkedPackageRoot,
			moduleDir
		};
		const configuredAliasRoot = await this.resolveConfiguredAliasRoot(realModulePath);
		return configuredAliasRoot === null ? null : {
			assetRoot: configuredAliasRoot,
			moduleDir
		};
	}
	async resolveContainedAsset(assetRoot, assetPath) {
		try {
			const realPath = await realpathNative(assetPath);
			return isPathInside(assetRoot, realPath) ? realPath : null;
		} catch {
			return null;
		}
	}
	findAlias(source) {
		return [...this.stringAliasesByFirstCharacter.get(source[0] ?? "") ?? [], ...this.regularExpressionAliases].filter((alias) => aliasMatches(alias.find, source)).sort((a, b) => a.index - b.index)[0];
	}
	getExpectedPackageName(source) {
		const packageName = getPackageNameFromSpecifier(source);
		return packageName === null ? void 0 : this.dependencyPackageNames.get(packageName);
	}
	async resolveAliasPackageRoot(alias, source, sourcePackageName, realResolvedPath) {
		const aliasTarget = applyAlias(alias.find, alias.replacement, source);
		if (!path.isAbsolute(aliasTarget)) return null;
		try {
			const realAliasTarget = await realpathNative(aliasTarget);
			const aliasTargetStat = await fs.promises.stat(realAliasTarget);
			const hasCapture = alias.find instanceof RegExp && alias.replacement.includes("$");
			let configuredDirectory = null;
			if (!hasCapture) {
				const realReplacement = await realpathNative(alias.replacement);
				if ((await fs.promises.stat(realReplacement)).isDirectory()) configuredDirectory = realReplacement;
			}
			if (configuredDirectory !== null || aliasTargetStat.isDirectory()) {
				const aliasBoundary = configuredDirectory ?? realAliasTarget;
				const packageRoot = await findPackageRoot(path.dirname(realResolvedPath));
				if (packageRoot === null || !isPathInside(aliasBoundary, packageRoot) || !isPathInside(packageRoot, realResolvedPath)) return null;
				return packageRoot;
			}
			const packageRoot = await findPackageRoot(path.dirname(realResolvedPath));
			if (packageRoot === null || !await packageOwnsAliasFile(packageRoot, sourcePackageName, realAliasTarget) || !isPathInside(packageRoot, realResolvedPath)) return null;
			return packageRoot;
		} catch {
			return null;
		}
	}
	async resolveConfiguredAliasRoot(realModulePath) {
		const packageRoot = await findPackageRoot(path.dirname(realModulePath));
		if (packageRoot === null || !isPathInside(packageRoot, realModulePath)) return null;
		for (const alias of this.configuredAliases) {
			if (!path.isAbsolute(alias.replacement)) continue;
			const packageName = typeof alias.find === "string" ? getPackageNameFromSpecifier(alias.find) : null;
			if (alias.replacement.indexOf("$") !== -1) {
				const packageManifestName = await readPackageName(packageRoot);
				if (packageManifestName === null || !aliasMatches(alias.find, packageManifestName)) continue;
				const aliasTarget = applyAlias(alias.find, alias.replacement, packageManifestName);
				if (!path.isAbsolute(aliasTarget)) continue;
				try {
					const realAliasTarget = await realpathNative(aliasTarget);
					const aliasTargetStat = await fs.promises.stat(realAliasTarget);
					if (aliasTargetStat.isDirectory() && isPathInside(realAliasTarget, realModulePath) || aliasTargetStat.isFile() && realAliasTarget === realModulePath) return packageRoot;
				} catch {}
				continue;
			}
			try {
				const realReplacement = await realpathNative(alias.replacement);
				if ((await fs.promises.stat(realReplacement)).isDirectory()) {
					if (isPathInside(packageRoot, realReplacement) && isPathInside(realReplacement, realModulePath) && await packageOwnsAliasDirectory(packageRoot, packageName, realReplacement)) return packageRoot;
					continue;
				}
				if (realReplacement === realModulePath && await packageOwnsAliasFile(packageRoot, packageName, realReplacement)) return packageRoot;
			} catch {}
		}
		return null;
	}
};
//#endregion
export { OgAssetOwnership };
