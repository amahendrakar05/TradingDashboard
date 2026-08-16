import path from "../deps/.pnpm/pathslash@0.1.0/deps/pathslash/dist/index.js";
import { createRequire } from "node:module";
//#region src/utils/vite-version.ts
/**
* Vite major-version detection.
*
* vinext requires Vite 8 or newer so it can rely on Rolldown-based build
* options, native `resolve.tsconfigPaths`, and OXC transforms.
*/
function serializeViteDefine(value) {
	if (typeof value === "string") return value;
	return JSON.stringify(value) ?? "undefined";
}
function getDepOptimizeNodeEnvOptions(nodeEnvDefine) {
	return { rolldownOptions: {
		transform: { define: { "process.env.NODE_ENV": nodeEnvDefine } },
		moduleTypes: {
			".js": "jsx",
			".mjs": "jsx"
		}
	} };
}
function getViteToolchainVersion() {
	try {
		return getViteToolchainVersionFromRequire(createRequire(path.join(process.cwd(), "package.json")));
	} catch (error) {
		if (!isModuleNotFoundError(error)) {
			const message = error instanceof Error ? error.message : String(error);
			throw new Error(`[vinext] Vite 8 or newer is required, but ${message}`);
		}
	}
	try {
		return getViteToolchainVersionFromRequire(createRequire(import.meta.url));
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		throw new Error(`[vinext] Vite 8 or newer is required, but vinext could not resolve vite/package.json (${message})`);
	}
}
function getViteToolchainVersionFromRequire(require) {
	const vitePkg = require("vite/package.json");
	if (vitePkg?.name === "vite" && parseViteVersion(vitePkg.version)) return { vite: vitePkg.version };
	const bundledViteVersion = vitePkg?.bundledVersions?.vite;
	if (parseViteVersion(bundledViteVersion)) {
		const bundledRolldownVersion = vitePkg?.bundledVersions?.rolldown;
		return {
			vite: bundledViteVersion,
			rolldown: parseViteVersion(bundledRolldownVersion) ? bundledRolldownVersion : void 0
		};
	}
	throw new Error(`could not determine Vite version from ${vitePkg?.name ?? "vite/package.json"}`);
}
function parseViteVersion(version) {
	if (typeof version !== "string") return null;
	const match = /^(\d+)\.(\d+)\.(\d+)(-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.exec(version);
	if (!match) return null;
	return [
		Number(match[1]),
		Number(match[2]),
		Number(match[3]),
		!!match[4]
	];
}
function isModuleNotFoundError(error) {
	return !!error && typeof error === "object" && "code" in error && error.code === "MODULE_NOT_FOUND";
}
function supportsNativeTypeofWindowFolding(viteVersion, bundledRolldownVersion) {
	if (bundledRolldownVersion !== void 0) return isVersionAtLeast(bundledRolldownVersion, 1, 1, 4);
	return isVersionAtLeast(viteVersion, 8, 1, 4);
}
function isVersionAtLeast(version, requiredMajor, requiredMinor, requiredPatch) {
	const parsedVersion = parseViteVersion(version);
	if (!parsedVersion) return false;
	const [major, minor, patch, prerelease] = parsedVersion;
	if (major !== requiredMajor) return major > requiredMajor;
	if (minor !== requiredMinor) return minor > requiredMinor;
	if (patch !== requiredPatch) return patch > requiredPatch;
	return !prerelease;
}
function assertSupportedViteVersion() {
	const toolchainVersion = getViteToolchainVersion();
	const [major] = parseViteVersion(toolchainVersion.vite);
	if (major < 8) throw new Error(`[vinext] Vite 8 or newer is required. Detected Vite ${major}.`);
	return { supportsNativeTypeofWindowFolding: supportsNativeTypeofWindowFolding(toolchainVersion.vite, toolchainVersion.rolldown) };
}
//#endregion
export { assertSupportedViteVersion, getDepOptimizeNodeEnvOptions, serializeViteDefine, supportsNativeTypeofWindowFolding };
