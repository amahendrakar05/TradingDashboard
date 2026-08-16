import { DYNAMIC_IMPORT_PRESCAN, forEachAstChild, hasRange, isAstRecord, nodeArray } from "./ast-utils.js";
import { parseAst } from "vite";
import MagicString from "magic-string";
//#region src/plugins/extensionless-dynamic-import.ts
const MODULE_EXTENSIONS = [
	".mjs",
	".js",
	".mts",
	".ts",
	".jsx",
	".tsx",
	".json"
];
const TRANSFORMABLE_EXTENSIONS = /* @__PURE__ */ new Set([
	".mjs",
	".js",
	".mts",
	".ts",
	".jsx",
	".tsx",
	".cjs",
	".cts"
]);
function createExtensionlessDynamicImportPlugin() {
	let moduleExtensions = MODULE_EXTENSIONS;
	return {
		name: "vinext:extensionless-dynamic-import",
		enforce: "pre",
		configResolved(config) {
			moduleExtensions = getModuleExtensions(config);
		},
		transform: {
			filter: {
				id: {
					include: /\.(?:[cm]?[jt]s|[jt]sx)(?:\?.*)?$/i,
					exclude: /[\\/]node_modules[\\/]/
				},
				code: DYNAMIC_IMPORT_PRESCAN
			},
			handler(code, id) {
				const lang = langForId(id);
				let ast;
				try {
					ast = parseAst(code, { lang });
				} catch {
					return null;
				}
				const imports = collectExtensionlessImports(ast, code, moduleExtensions);
				if (imports.length === 0) return null;
				const output = new MagicString(code);
				for (const dynamicImport of imports) {
					const source = code.slice(dynamicImport.sourceStart, dynamicImport.sourceEnd);
					output.overwrite(dynamicImport.start, dynamicImport.end, buildReplacement(source, dynamicImport.globPattern, dynamicImport.moduleExtensions));
				}
				return {
					code: output.toString(),
					map: output.generateMap({ hires: "boundary" })
				};
			}
		}
	};
}
function langForId(id) {
	const clean = id.split("?", 1)[0];
	const dot = clean.lastIndexOf(".");
	if (dot < 0) return null;
	const ext = clean.slice(dot).toLowerCase();
	if (!TRANSFORMABLE_EXTENSIONS.has(ext)) return null;
	if (ext === ".ts" || ext === ".mts" || ext === ".cts") return "ts";
	if (ext === ".tsx") return "tsx";
	return "jsx";
}
function collectExtensionlessImports(ast, code, moduleExtensions) {
	const imports = [];
	function visit(value) {
		if (!isAstRecord(value)) return;
		const parsed = parseExtensionlessImport(value, code, moduleExtensions);
		if (parsed) {
			imports.push(parsed);
			return;
		}
		forEachAstChild(value, visit);
	}
	visit(ast);
	return imports;
}
function parseExtensionlessImport(node, code, moduleExtensions) {
	if (node.type !== "ImportExpression" || !hasRange(node)) return null;
	if (node.options != null) return null;
	const source = node.source;
	if (!isAstRecord(source) || source.type !== "TemplateLiteral" || !hasRange(source)) return null;
	if (nodeArray(source.expressions).length === 0) return null;
	const quasiTexts = nodeArray(source.quasis).map(templateElementText);
	if (quasiTexts.some((text) => text == null)) return null;
	const texts = quasiTexts;
	const first = texts[0];
	if (!isImportPrefix(code.slice(node.start, source.start))) return null;
	if (!(first.startsWith("./") || first.startsWith("../"))) return null;
	if (texts.some((text) => /[*?[\]{}()!?#]/.test(text))) return null;
	if (texts.slice(1).some((text) => text.includes("."))) return null;
	const directoryEnd = first.lastIndexOf("/") + 1;
	const directory = first.slice(0, directoryEnd);
	const filenamePrefix = first.slice(directoryEnd);
	if (filenamePrefix.includes(".")) return null;
	return {
		start: node.start,
		end: node.end,
		sourceStart: source.start,
		sourceEnd: source.end,
		globPattern: filenamePrefix.length > 0 ? [`${first}*`, `${first}*/**/*`] : `${directory}**/*`,
		moduleExtensions
	};
}
function isImportPrefix(value) {
	const prefix = value.match(/^import\s*\(/)?.[0];
	if (!prefix) return false;
	let index = prefix.length;
	while (index < value.length) {
		const char = value[index];
		if (/\s/.test(char)) {
			index += 1;
			continue;
		}
		if (value.startsWith("/*", index)) {
			const commentEnd = value.indexOf("*/", index + 2);
			if (commentEnd < 0) return false;
			index = commentEnd + 2;
			continue;
		}
		if (value.startsWith("//", index)) {
			const lineEnd = value.indexOf("\n", index + 2);
			if (lineEnd < 0) return true;
			index = lineEnd + 1;
			continue;
		}
		return false;
	}
	return true;
}
function templateElementText(value) {
	if (!isAstRecord(value) || value.type !== "TemplateElement") return null;
	const templateValue = value.value;
	if (typeof templateValue !== "object" || templateValue === null) return null;
	const cooked = Reflect.get(templateValue, "cooked");
	return typeof cooked === "string" ? cooked : null;
}
function getModuleExtensions(config) {
	return config.resolve.extensions.filter((extension) => extension !== ".node");
}
function buildReplacement(source, globPattern, moduleExtensions) {
	const extensions = JSON.stringify(moduleExtensions);
	return `((__vinextPath, __vinextModules = import.meta.glob(${JSON.stringify(globPattern)}), __vinextExtensions = ${extensions}) => { const __vinextLoader = __vinextModules[__vinextPath] ?? __vinextExtensions.map((__vinextExtension) => __vinextModules[__vinextPath + __vinextExtension]).find(Boolean) ?? __vinextExtensions.map((__vinextExtension) => __vinextModules[__vinextPath + "/index" + __vinextExtension]).find(Boolean); return __vinextLoader ? __vinextLoader() : Promise.reject(new Error("Cannot find module '" + __vinextPath + "'")); })(${source})`;
}
//#endregion
export { createExtensionlessDynamicImportPlugin };
