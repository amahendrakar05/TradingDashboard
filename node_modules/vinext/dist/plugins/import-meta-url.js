import path, { toSlash } from "../deps/.pnpm/pathslash@0.1.0/deps/pathslash/dist/index.js";
import { VIRTUAL_MODULE_ID_RE } from "../utils/virtual-module.js";
import { collectBindingNames, forEachAstChild, hasRange, isAstRecord, isIdentifierNamed, nodeArray } from "./ast-utils.js";
import { tryRealpathSync } from "../build/ssr-manifest.js";
import { parseAst } from "vite";
import { pathToFileURL } from "node:url";
import MagicString from "magic-string";
//#region src/plugins/import-meta-url.ts
const TRANSFORMABLE_SCRIPT_EXTENSIONS = /* @__PURE__ */ new Set([
	".cjs",
	".cts",
	".js",
	".jsx",
	".mjs",
	".mts",
	".ts",
	".tsx"
]);
function createImportMetaUrlPlugin(options) {
	let rootPaths;
	let outputDirs = [];
	function getRootPaths() {
		const root = options.getRoot();
		if (!root) return rootPaths;
		if (!rootPaths || rootPaths.root !== root) rootPaths = createRootPaths(root, { outputDirs });
		return rootPaths;
	}
	return {
		name: "vinext:import-meta-url",
		enforce: "post",
		configResolved(config) {
			const root = options.getRoot() ?? config.root;
			outputDirs = [config.build.outDir];
			rootPaths = createRootPaths(root, { outputDirs });
		},
		transform: {
			filter: {
				id: {
					include: /\.(?:[cm]?[jt]s|[jt]sx)(?:\?.*)?$/,
					exclude: [/[\\/]node_modules[\\/]/, VIRTUAL_MODULE_ID_RE]
				},
				code: /import\.meta(?:\.|\?\.)url|__filename|__dirname/
			},
			handler(code, id) {
				const paths = getRootPaths();
				if (!paths) return null;
				const canonicalId = transformableModuleCanonicalId(cleanModuleId(id), paths);
				if (!canonicalId) return null;
				const rewritten = rewriteCanonicalSourceIdentity(code, canonicalId, paths, this.environment?.name === "client" ? "client" : "server");
				if (!rewritten) return null;
				return {
					code: rewritten.code,
					map: rewritten.map
				};
			}
		}
	};
}
function rewriteImportMetaUrl(code, id, root, environment) {
	if (!mayContainImportMetaUrl(code)) return null;
	return rewriteCanonicalSourceIdentity(code, canonicalizePath(id), createRootPaths(root), environment);
}
function rewriteServerCjsGlobals(code, id, root) {
	if (!mayContainServerCjsGlobal(code)) return null;
	const rootPaths = createRootPaths(root);
	const canonicalId = transformableModuleCanonicalId(id, rootPaths);
	if (!canonicalId) return null;
	return rewriteCanonicalSourceIdentity(code, canonicalId, rootPaths, "server");
}
function rewriteCanonicalSourceIdentity(code, canonicalId, rootPaths, environment) {
	let ast;
	try {
		ast = parseAst(code);
	} catch {
		return null;
	}
	const output = new MagicString(code);
	let changed = false;
	if (mayContainImportMetaUrl(code)) {
		const importMetaRanges = collectImportMetaUrlRanges(ast);
		if (importMetaRanges.length > 0) {
			const replacement = JSON.stringify(importMetaUrlValue(canonicalId, rootPaths, environment));
			for (const range of importMetaRanges) {
				output.overwrite(range.start, range.end, replacement);
				changed = true;
			}
		}
	}
	if (environment === "server" && mayContainServerCjsGlobal(code)) {
		const injected = injectServerCjsGlobals(ast, canonicalId);
		if (injected) {
			output.appendLeft(findDirectivePrologueEnd(ast), `\n${injected}`);
			changed = true;
		}
	}
	if (!changed) return null;
	return {
		code: output.toString(),
		map: output.generateMap({ hires: "boundary" })
	};
}
function cleanModuleId(id) {
	return id.split("?", 1)[0];
}
function createRootPaths(root, options = {}) {
	const canonicalRoot = canonicalizePath(root);
	return {
		root,
		canonicalRoot,
		excludedRelativePrefixes: excludedRelativePrefixes(canonicalRoot, options)
	};
}
function transformableModuleCanonicalId(id, rootPaths) {
	if (!id || id.startsWith("\0")) return null;
	if (!path.isAbsolute(id)) return null;
	const slashedInputId = toSlash(id);
	if (slashedInputId.includes("/node_modules/")) return null;
	if (!TRANSFORMABLE_SCRIPT_EXTENSIONS.has(path.extname(slashedInputId))) return null;
	const canonicalId = canonicalizePath(id);
	if (!isPathWithin(canonicalId, rootPaths.canonicalRoot)) return null;
	if (isExcludedRelativePath(path.relative(rootPaths.canonicalRoot, canonicalId), rootPaths.excludedRelativePrefixes)) return null;
	return canonicalId;
}
function mayContainImportMetaUrl(code) {
	return code.includes("import.meta.url") || code.includes("import.meta?.url");
}
function mayContainServerCjsGlobal(code) {
	return code.includes("__filename") || code.includes("__dirname");
}
function excludedRelativePrefixes(canonicalRoot, options) {
	const prefixes = /* @__PURE__ */ new Set([
		".next",
		".vinext",
		".vinext-local-package",
		"dist",
		"out"
	]);
	for (const outputDir of options.outputDirs ?? []) {
		const canonicalOutputDir = canonicalizePath(path.isAbsolute(outputDir) ? outputDir : path.resolve(canonicalRoot, outputDir));
		if (!isPathWithin(canonicalOutputDir, canonicalRoot)) continue;
		const relativePath = path.relative(canonicalRoot, canonicalOutputDir);
		if (relativePath && relativePath !== ".") prefixes.add(relativePath);
	}
	return [...prefixes];
}
function isExcludedRelativePath(relativePath, prefixes) {
	return prefixes.some((prefix) => relativePath === prefix || relativePath.startsWith(`${prefix}/`));
}
function isPathWithin(candidate, root) {
	return candidate === root || candidate.startsWith(root.endsWith("/") ? root : `${root}/`);
}
function importMetaUrlValue(canonicalId, rootPaths, environment) {
	if (environment === "client") return `file:///ROOT/${path.relative(rootPaths.canonicalRoot, canonicalId)}`;
	return pathToFileURL(canonicalId).href;
}
function canonicalizePath(value) {
	const real = tryRealpathSync(value);
	return real === null ? path.resolve(value) : toSlash(real);
}
function collectImportMetaUrlRanges(ast) {
	const ranges = [];
	function visit(value) {
		if (!isAstRecord(value)) return;
		if (isImportMetaUrlNode(value)) {
			ranges.push({
				start: value.start,
				end: value.end
			});
			return;
		}
		if (isChainExpressionWrappingImportMetaUrl(value)) {
			ranges.push({
				start: value.start,
				end: value.end
			});
			return;
		}
		if (isNewUrlExpression(value)) {
			const args = nodeArray(value.arguments);
			for (let index = 0; index < args.length; index += 1) {
				if (index === 1 && isImportMetaUrlOrChainedNode(args[index])) continue;
				visit(args[index]);
			}
			return;
		}
		forEachAstChild(value, visit);
	}
	visit(ast);
	return ranges;
}
const CJS_GLOBALS = ["__filename", "__dirname"];
function isCjsGlobalName(name) {
	return name === "__filename" || name === "__dirname";
}
function injectServerCjsGlobals(ast, canonicalId) {
	const analysis = analyzeServerCjsGlobals(ast);
	const values = {
		__filename: canonicalId,
		__dirname: path.dirname(canonicalId)
	};
	const parts = CJS_GLOBALS.filter((name) => analysis.reads.has(name) && !analysis.moduleBindings.has(name)).map((name) => `var ${name} = ${JSON.stringify(values[name])};`);
	return parts.length ? parts.join("") : null;
}
function analyzeServerCjsGlobals(ast) {
	const reads = /* @__PURE__ */ new Set();
	const moduleBindings = /* @__PURE__ */ new Set();
	function recordBinding(pattern) {
		const names = /* @__PURE__ */ new Set();
		collectBindingNames(pattern, names);
		for (const name of names) if (isCjsGlobalName(name)) moduleBindings.add(name);
	}
	function recordDirectTopLevelBindings(statement) {
		switch (statement.type) {
			case "ImportDeclaration":
				for (const specifier of nodeArray(statement.specifiers)) {
					if (!isAstRecord(specifier)) continue;
					recordBinding(specifier.local);
				}
				return;
			case "VariableDeclaration":
				if (statement.kind === "var") return;
				for (const declarator of nodeArray(statement.declarations)) {
					if (!isAstRecord(declarator) || declarator.type !== "VariableDeclarator") continue;
					recordBinding(declarator.id);
				}
				return;
			case "FunctionDeclaration":
			case "ClassDeclaration":
				recordBinding(statement.id);
				return;
			case "ExportNamedDeclaration":
			case "ExportDefaultDeclaration":
				if (isAstRecord(statement.declaration)) recordDirectTopLevelBindings(statement.declaration);
				return;
		}
	}
	function recordModuleScopedVarBindings(node) {
		if (!isAstRecord(node)) return;
		switch (node.type) {
			case "Program":
				for (const statement of nodeArray(node.body)) {
					if (!isAstRecord(statement)) continue;
					recordDirectTopLevelBindings(statement);
					recordModuleScopedVarBindings(statement);
				}
				return;
			case "VariableDeclaration":
				if (node.kind !== "var") return;
				for (const declarator of nodeArray(node.declarations)) {
					if (!isAstRecord(declarator) || declarator.type !== "VariableDeclarator") continue;
					recordBinding(declarator.id);
				}
				return;
			case "FunctionDeclaration":
			case "FunctionExpression":
			case "ArrowFunctionExpression":
			case "ClassDeclaration":
			case "ClassExpression": return;
			default: for (const child of moduleScopeChildren(node)) recordModuleScopedVarBindings(child);
		}
	}
	function moduleScopeChildren(node) {
		switch (node.type) {
			case "BlockStatement": return nodeArray(node.body);
			case "IfStatement": return [node.consequent, node.alternate];
			case "SwitchStatement": return nodeArray(node.cases);
			case "SwitchCase": return nodeArray(node.consequent);
			case "TryStatement": return [
				node.block,
				node.handler,
				node.finalizer
			];
			case "CatchClause": return [node.body];
			case "LabeledStatement": return [node.body];
			case "ForStatement": return [node.init, node.body];
			case "ForInStatement":
			case "ForOfStatement": return [node.left, node.body];
			case "WhileStatement":
			case "DoWhileStatement":
			case "WithStatement": return [node.body];
			case "ExportNamedDeclaration":
			case "ExportDefaultDeclaration": return [node.declaration];
			default: return [];
		}
	}
	function recordReads(value) {
		if (!isAstRecord(value)) return;
		switch (value.type) {
			case "Identifier":
				if (isCjsGlobalName(value.name)) reads.add(value.name);
				return;
			case "MemberExpression":
				recordReads(value.object);
				if (value.computed) recordReads(value.property);
				return;
			case "Property":
				if (value.computed) recordReads(value.key);
				recordReads(value.value);
				return;
			case "MethodDefinition":
			case "PropertyDefinition":
				if (value.computed) recordReads(value.key);
				recordReads(value.value);
				return;
			case "ImportDeclaration": return;
			case "ExportAllDeclaration": return;
			case "ExportNamedDeclaration":
				if (isAstRecord(value.declaration)) recordReads(value.declaration);
				else if (!value.source) {
					for (const specifier of nodeArray(value.specifiers)) if (isAstRecord(specifier)) recordReads(specifier.local);
				}
				return;
			default: forEachAstChild(value, recordReads);
		}
	}
	if (isAstRecord(ast) && ast.type === "Program") recordModuleScopedVarBindings(ast);
	recordReads(ast);
	return {
		reads,
		moduleBindings
	};
}
function isImportMetaNode(value) {
	return isAstRecord(value) && value.type === "MetaProperty" && isIdentifierNamed(value.meta, "import") && isIdentifierNamed(value.property, "meta");
}
function isImportMetaUrlNode(value) {
	return isAstRecord(value) && value.type === "MemberExpression" && hasRange(value) && isImportMetaNode(value.object) && isIdentifierNamed(value.property, "url");
}
function isImportMetaUrlOrChainedNode(value) {
	if (isImportMetaUrlNode(value)) return true;
	return isAstRecord(value) && value.type === "ChainExpression" && isImportMetaUrlNode(value.expression);
}
function isChainExpressionWrappingImportMetaUrl(value) {
	return isAstRecord(value) && value.type === "ChainExpression" && hasRange(value) && isImportMetaUrlNode(value.expression);
}
function isNewUrlExpression(value) {
	return value.type === "NewExpression" && isIdentifierNamed(value.callee, "URL");
}
function findDirectivePrologueEnd(ast) {
	if (!isAstRecord(ast) || ast.type !== "Program") return 0;
	let end = 0;
	const hashbang = ast.hashbang;
	const hashbangEnd = typeof hashbang === "object" && hashbang !== null ? Reflect.get(hashbang, "end") : null;
	if (typeof hashbangEnd === "number") end = hashbangEnd;
	for (const statement of nodeArray(ast.body)) {
		if (!isAstRecord(statement) || statement.type !== "ExpressionStatement" || !isAstRecord(statement.expression) || statement.expression.type !== "Literal" || typeof statement.expression.value !== "string" || typeof statement.end !== "number") break;
		end = statement.end;
	}
	return end;
}
//#endregion
export { createImportMetaUrlPlugin, rewriteImportMetaUrl, rewriteServerCjsGlobals };
