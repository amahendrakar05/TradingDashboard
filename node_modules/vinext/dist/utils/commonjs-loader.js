import { Module, createRequire } from "node:module";
import fs from "node:fs";
import nodePath from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
//#region src/utils/commonjs-loader.ts
const CommonJsModule = Module;
function canonicalPath(filePath) {
	const normalizedPath = filePath.startsWith("/@fs/") ? filePath.slice(4) : filePath;
	const resolvedPath = normalizedPath.startsWith("file://") ? fileURLToPath(normalizedPath) : normalizedPath;
	try {
		return fs.realpathSync.native(resolvedPath);
	} catch {
		return nodePath.resolve(resolvedPath);
	}
}
function shouldRetryAsCommonJs(error, resolvedPath) {
	if (!resolvedPath.endsWith(".js") || !(error instanceof Error)) return false;
	if ("code" in error && error.code === "ERR_REQUIRE_ESM") {
		const canonicalResolvedPath = canonicalPath(resolvedPath);
		return error.message.includes(canonicalResolvedPath) || error.message.includes(pathToFileURL(canonicalResolvedPath).href);
	}
	if (!(error instanceof ReferenceError)) return false;
	const match = error.message.match(/^(module|exports|require|__dirname|__filename) is not defined(?: in ES module scope)?/);
	if (!match || !error.stack) return false;
	const identifier = match[1];
	for (const line of error.stack.split("\n").slice(1)) {
		const location = line.match(/(?:\(|at )(.+):(\d+):(\d+)\)?$/);
		if (!location) continue;
		const [, framePath, lineNumberText, columnNumberText] = location;
		const canonicalFramePath = canonicalPath(framePath);
		if (!canonicalFramePath.endsWith(".js")) continue;
		let sourceLine;
		try {
			sourceLine = fs.readFileSync(canonicalFramePath, "utf8").split(/\r?\n/)[Number(lineNumberText) - 1];
		} catch {
			continue;
		}
		const column = Number(columnNumberText) - 1;
		if (sourceLine?.slice(column, column + identifier.length) === identifier) return true;
	}
	return false;
}
function compileCommonJsModule(resolvedPath, parent) {
	resolvedPath = canonicalPath(resolvedPath);
	const req = createRequire(resolvedPath);
	const cached = req.cache[resolvedPath];
	if (cached) return cached.exports;
	const mod = new CommonJsModule(resolvedPath, parent);
	mod.filename = resolvedPath;
	mod.paths = CommonJsModule._nodeModulePaths(nodePath.dirname(resolvedPath));
	req.cache[resolvedPath] = mod;
	const originalRequire = mod.require.bind(mod);
	mod.require = ((specifier) => {
		let dependencyPath;
		try {
			dependencyPath = req.resolve(specifier);
		} catch {
			return originalRequire(specifier);
		}
		if (dependencyPath.endsWith(".cjs")) return compileCommonJsModule(dependencyPath, mod);
		try {
			return originalRequire(specifier);
		} catch (error) {
			if (!shouldRetryAsCommonJs(error, dependencyPath)) throw error;
			return compileCommonJsModule(dependencyPath, mod);
		}
	});
	try {
		mod._compile(fs.readFileSync(resolvedPath, "utf8"), resolvedPath);
		mod.loaded = true;
		return mod.exports;
	} catch (error) {
		if (req.cache[resolvedPath] === mod) delete req.cache[resolvedPath];
		throw error;
	}
}
/**
* Load a `.js` file as CommonJS even when a surrounding `package.json`
* declares `"type": "module"`. Nested misclassified `.js` dependencies are
* compiled the same way, while Node keeps handling builtins, JSON, native
* addons, and correctly classified modules through its normal loader.
*/
function loadCommonJsModule(resolvedPath) {
	return compileCommonJsModule(resolvedPath);
}
/**
* Import a module normally, retrying only `.js` files that fail because Node
* classified CommonJS source as ESM.
*/
async function importExportWithCommonJsFallback(resolvedPath) {
	try {
		const mod = await import(pathToFileURL(resolvedPath).href);
		return mod.default ?? mod;
	} catch (error) {
		if (!shouldRetryAsCommonJs(error, resolvedPath)) throw error;
		return loadCommonJsModule(resolvedPath);
	}
}
//#endregion
export { importExportWithCommonJsFallback, loadCommonJsModule, shouldRetryAsCommonJs };
