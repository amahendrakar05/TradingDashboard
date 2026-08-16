import path, { toSlash } from "../deps/.pnpm/pathslash@0.1.0/deps/pathslash/dist/index.js";
import { isUnknownRecord } from "../utils/record.js";
import { hasTrailingComma } from "../utils/has-trailing-comma.js";
import { relativeWithinRoot, tryRealpathSync } from "../build/ssr-manifest.js";
import { parseAst } from "vite";
import MagicString from "magic-string";
//#region src/plugins/dynamic-preload-metadata.ts
function getString(node, key) {
	const value = node[key];
	return typeof value === "string" ? value : null;
}
function getNumber(node, key) {
	const value = node[key];
	return typeof value === "number" ? value : null;
}
function getArray(node, key) {
	const value = node[key];
	return Array.isArray(value) ? value : [];
}
function getBoolean(node, key) {
	return node[key] === true;
}
function nodeName(node) {
	if (!isUnknownRecord(node)) return null;
	const name = node.name;
	if (typeof name === "string") return name;
	const value = node.value;
	return typeof value === "string" ? value : null;
}
function nodeStringValue(node) {
	if (!isUnknownRecord(node)) return null;
	const value = node.value;
	return typeof value === "string" ? value : null;
}
function walkAst(value, visitor) {
	if (!isUnknownRecord(value)) return;
	visitor(value);
	for (const [key, child] of Object.entries(value)) {
		if (key === "parent") continue;
		if (Array.isArray(child)) for (const item of child) walkAst(item, visitor);
		else if (isUnknownRecord(child)) walkAst(child, visitor);
	}
}
function importSource(node) {
	const source = node.source;
	if (!isUnknownRecord(source)) return null;
	return nodeStringValue(source);
}
function isNextDynamicSource(source) {
	return source === "next/dynamic" || source === "next/dynamic.js";
}
function collectDynamicImportLocals(ast) {
	const locals = /* @__PURE__ */ new Set();
	if (!isUnknownRecord(ast)) return locals;
	for (const node of getArray(ast, "body")) {
		if (!isUnknownRecord(node)) continue;
		if (getString(node, "type") !== "ImportDeclaration") continue;
		if (!isNextDynamicSource(importSource(node))) continue;
		for (const specifier of getArray(node, "specifiers")) {
			if (!isUnknownRecord(specifier)) continue;
			if (getString(specifier, "type") !== "ImportDefaultSpecifier") continue;
			const local = nodeName(specifier.local);
			if (local) locals.add(local);
		}
	}
	return locals;
}
function isIdentifierNameInSet(node, names) {
	if (!isUnknownRecord(node)) return false;
	return getString(node, "type") === "Identifier" && names.has(getString(node, "name") ?? "");
}
function isDynamicCall(node, dynamicLocals) {
	if (getString(node, "type") !== "CallExpression") return false;
	return isIdentifierNameInSet(node.callee, dynamicLocals);
}
function addBindingName(pattern, names) {
	if (!isUnknownRecord(pattern)) return;
	const type = getString(pattern, "type");
	if (type === null) return;
	switch (type) {
		case "Identifier": {
			const name = getString(pattern, "name");
			if (name) names.add(name);
			return;
		}
		case "AssignmentPattern":
			addBindingName(pattern.left, names);
			return;
		case "RestElement":
			addBindingName(pattern.argument, names);
			return;
		case "ArrayPattern":
			for (const element of getArray(pattern, "elements")) addBindingName(element, names);
			return;
		case "ObjectPattern":
			for (const property of getArray(pattern, "properties")) {
				if (!isUnknownRecord(property)) continue;
				if (getString(property, "type") === "RestElement") {
					addBindingName(property.argument, names);
					continue;
				}
				addBindingName(property.value, names);
			}
			return;
		default: return;
	}
}
function addVariableDeclarationBindingNames(node, names) {
	if (!isUnknownRecord(node) || getString(node, "type") !== "VariableDeclaration") return;
	for (const declaration of getArray(node, "declarations")) if (isUnknownRecord(declaration)) addBindingName(declaration.id, names);
}
function collectBlockScopedBindingNames(body) {
	const names = /* @__PURE__ */ new Set();
	for (const statement of body) {
		if (!isUnknownRecord(statement)) continue;
		const type = getString(statement, "type");
		if (type === "VariableDeclaration") {
			if (getString(statement, "kind") !== "var") addVariableDeclarationBindingNames(statement, names);
			continue;
		}
		if (type === "FunctionDeclaration" || type === "ClassDeclaration") {
			const name = nodeName(statement.id);
			if (name) names.add(name);
		}
	}
	return names;
}
function collectSwitchScopedBindingNames(node) {
	const names = /* @__PURE__ */ new Set();
	for (const switchCase of getArray(node, "cases")) {
		if (!isUnknownRecord(switchCase)) continue;
		for (const statement of getArray(switchCase, "consequent")) for (const name of collectBlockScopedBindingNames([statement])) names.add(name);
	}
	return names;
}
function collectVarBindingNames(value, names) {
	if (!isUnknownRecord(value)) return;
	const type = getString(value, "type");
	if (type === "FunctionDeclaration" || type === "FunctionExpression" || type === "ArrowFunctionExpression") return;
	if (type === "VariableDeclaration" && getString(value, "kind") === "var") addVariableDeclarationBindingNames(value, names);
	for (const [key, child] of Object.entries(value)) {
		if (key === "parent") continue;
		if (Array.isArray(child)) for (const item of child) collectVarBindingNames(item, names);
		else if (isUnknownRecord(child)) collectVarBindingNames(child, names);
	}
}
function collectFunctionScopeBindingNames(node) {
	const names = /* @__PURE__ */ new Set();
	if (getString(node, "type") === "FunctionExpression") {
		const name = nodeName(node.id);
		if (name) names.add(name);
	}
	for (const param of getArray(node, "params")) addBindingName(param, names);
	collectVarBindingNames(node.body, names);
	return names;
}
function collectForBindingNames(node) {
	const names = /* @__PURE__ */ new Set();
	addVariableDeclarationBindingNames(node.init, names);
	addVariableDeclarationBindingNames(node.left, names);
	return names;
}
function withoutBindings(activeNames, localNames) {
	if (activeNames.size === 0 || localNames.size === 0) return activeNames;
	let scoped = null;
	for (const name of localNames) {
		if (!activeNames.has(name)) continue;
		scoped ??= new Set(activeNames);
		scoped.delete(name);
	}
	return scoped ?? activeNames;
}
function visitChildren(node, dynamicLocals, visitor) {
	for (const [key, child] of Object.entries(node)) {
		if (key === "parent") continue;
		if (Array.isArray(child)) for (const item of child) visitDynamicCalls(item, dynamicLocals, visitor);
		else if (isUnknownRecord(child)) visitDynamicCalls(child, dynamicLocals, visitor);
	}
}
function visitDynamicCalls(value, dynamicLocals, visitor) {
	if (!isUnknownRecord(value) || dynamicLocals.size === 0) return;
	const type = getString(value, "type");
	if (type === "Program") {
		const scoped = withoutBindings(dynamicLocals, collectBlockScopedBindingNames(getArray(value, "body")));
		for (const statement of getArray(value, "body")) visitDynamicCalls(statement, scoped, visitor);
		return;
	}
	if (type === "BlockStatement") {
		const scoped = withoutBindings(dynamicLocals, collectBlockScopedBindingNames(getArray(value, "body")));
		for (const statement of getArray(value, "body")) visitDynamicCalls(statement, scoped, visitor);
		return;
	}
	if (type === "SwitchStatement") {
		visitDynamicCalls(value.discriminant, dynamicLocals, visitor);
		const scoped = withoutBindings(dynamicLocals, collectSwitchScopedBindingNames(value));
		for (const switchCase of getArray(value, "cases")) visitDynamicCalls(switchCase, scoped, visitor);
		return;
	}
	if (type === "FunctionDeclaration" || type === "FunctionExpression" || type === "ArrowFunctionExpression") {
		visitChildren(value, withoutBindings(dynamicLocals, collectFunctionScopeBindingNames(value)), visitor);
		return;
	}
	if (type === "ClassDeclaration" || type === "ClassExpression") {
		const names = /* @__PURE__ */ new Set();
		const name = nodeName(value.id);
		if (name) names.add(name);
		visitChildren(value, withoutBindings(dynamicLocals, names), visitor);
		return;
	}
	if (type === "ForStatement" || type === "ForInStatement" || type === "ForOfStatement") {
		visitChildren(value, withoutBindings(dynamicLocals, collectForBindingNames(value)), visitor);
		return;
	}
	if (type === "CatchClause") {
		const names = /* @__PURE__ */ new Set();
		addBindingName(value.param, names);
		visitChildren(value, withoutBindings(dynamicLocals, names), visitor);
		return;
	}
	if (isDynamicCall(value, dynamicLocals)) visitor(value);
	visitChildren(value, dynamicLocals, visitor);
}
function collectImportSpecifiers(node) {
	const specifiers = [];
	const seen = /* @__PURE__ */ new Set();
	walkAst(node, (item) => {
		if (getString(item, "type") === "ImportExpression") {
			const specifier = nodeStringValue(item.source);
			if (specifier && !seen.has(specifier)) {
				seen.add(specifier);
				specifiers.push(specifier);
			}
			return;
		}
		if (getString(item, "type") !== "CallExpression") return;
		const callee = item.callee;
		if (!isUnknownRecord(callee) || getString(callee, "type") !== "Import") return;
		const firstArg = getArray(item, "arguments")[0];
		const specifier = nodeStringValue(firstArg);
		if (specifier && !seen.has(specifier)) {
			seen.add(specifier);
			specifiers.push(specifier);
		}
	});
	return specifiers;
}
function propertyKeyName(property) {
	if (!isUnknownRecord(property)) return null;
	if (getBoolean(property, "computed")) return null;
	return nodeName(property.key);
}
function objectProperties(node) {
	if (!isUnknownRecord(node) || getString(node, "type") !== "ObjectExpression") return [];
	return getArray(node, "properties").filter(isUnknownRecord);
}
function hasObjectProperty(node, name) {
	return objectProperties(node).some((property) => propertyKeyName(property) === name);
}
function findObjectProperty(node, name) {
	return objectProperties(node).find((property) => propertyKeyName(property) === name) ?? null;
}
function dynamicLoaderNode(firstArg) {
	if (!isUnknownRecord(firstArg) || getString(firstArg, "type") !== "ObjectExpression") return firstArg;
	return (findObjectProperty(firstArg, "loader") ?? findObjectProperty(firstArg, "modules"))?.value;
}
function findLastEndedProperty(node) {
	const properties = objectProperties(node);
	for (let index = properties.length - 1; index >= 0; index -= 1) if (getNumber(properties[index], "end") !== null) return properties[index];
	return null;
}
function appendObjectProperty(output, objectNode, property) {
	const start = getNumber(objectNode, "start");
	const end = getNumber(objectNode, "end");
	if (start === null || end === null) return false;
	const lastProperty = findLastEndedProperty(objectNode);
	if (!lastProperty) {
		output.appendLeft(start + 1, property);
		return true;
	}
	const propertyEnd = getNumber(lastProperty, "end");
	if (propertyEnd === null) return false;
	output.appendLeft(propertyEnd, `, ${property}`);
	return true;
}
function insertSecondOptionsArgument(output, code, callNode, firstArg, optionsLiteral) {
	const callEnd = getNumber(callNode, "end");
	const firstArgEnd = getNumber(firstArg, "end");
	if (callEnd === null || firstArgEnd === null) return false;
	const closeParen = callEnd - 1;
	const separator = hasTrailingComma(code.slice(firstArgEnd, closeParen)) ? " " : ", ";
	output.appendLeft(closeParen, `${separator}${optionsLiteral}`);
	return true;
}
function cleanResolvedId(id) {
	let start = 0;
	while (start < id.length && id.charCodeAt(start) === 0) start += 1;
	return toSlash(id.slice(start).replace(/^\/@fs\//, "/").split("?")[0]);
}
const rootRealpathCache = /* @__PURE__ */ new Map();
function cachedRootRealpath(root) {
	if (!rootRealpathCache.has(root)) rootRealpathCache.set(root, tryRealpathSync(root));
	return rootRealpathCache.get(root) ?? null;
}
/** `code` offset -> human `:line:column` (1-based), for build error messages. */
function formatNodeLocation(code, node) {
	const start = getNumber(node, "start");
	if (start === null) return "";
	const before = code.slice(0, start);
	return `:${before.split("\n").length}:${start - before.lastIndexOf("\n")}`;
}
function toManifestModuleId(root, resolvedId) {
	const cleaned = cleanResolvedId(resolvedId);
	if (!path.isAbsolute(cleaned)) return cleaned.replace(/^\/+/, "");
	const rootCandidates = /* @__PURE__ */ new Set([root]);
	const realRoot = cachedRootRealpath(root);
	if (realRoot) rootCandidates.add(toSlash(realRoot));
	const moduleCandidates = /* @__PURE__ */ new Set([cleaned]);
	const realCleaned = tryRealpathSync(cleaned);
	if (realCleaned) moduleCandidates.add(toSlash(realCleaned));
	for (const rootCandidate of rootCandidates) for (const moduleCandidate of moduleCandidates) {
		const relative = relativeWithinRoot(rootCandidate, moduleCandidate);
		if (relative) return relative;
	}
	return null;
}
async function resolveManifestModuleIds(specifiers, importer, root, resolveDynamicImport) {
	const resolvedIds = [];
	const seen = /* @__PURE__ */ new Set();
	for (const specifier of specifiers) {
		const resolved = await resolveDynamicImport(specifier, importer);
		const moduleId = resolved ? toManifestModuleId(root, resolved) : null;
		if (!moduleId || seen.has(moduleId)) continue;
		seen.add(moduleId);
		resolvedIds.push(moduleId);
	}
	return resolvedIds;
}
function shouldSkipCall(firstArg, secondArg) {
	if (hasObjectProperty(firstArg, "loadableGenerated")) return true;
	return hasObjectProperty(secondArg, "loadableGenerated");
}
function applyLoadableGenerated(output, code, callNode, moduleIds) {
	const args = getArray(callNode, "arguments");
	const firstArg = args[0];
	const secondArg = args[1];
	if (!isUnknownRecord(firstArg)) return false;
	if (shouldSkipCall(firstArg, secondArg)) return false;
	const property = `loadableGenerated: { modules: ${JSON.stringify(moduleIds)} }`;
	if (getString(firstArg, "type") === "ObjectExpression") return appendObjectProperty(output, firstArg, property);
	if (secondArg === void 0) return insertSecondOptionsArgument(output, code, callNode, firstArg, `{ ${property} }`);
	if (isUnknownRecord(secondArg) && getString(secondArg, "type") === "ObjectExpression") return appendObjectProperty(output, secondArg, property);
	return false;
}
async function transformNextDynamicPreloadMetadata(code, id, root, resolveDynamicImport) {
	if (!code.includes("next/dynamic")) return null;
	let ast;
	try {
		ast = parseAst(code);
	} catch (error) {
		if (typeof process !== "undefined" && process.env?.DEBUG?.includes("vinext")) console.debug(`[vinext] dynamic-preload-metadata: failed to parse ${id}:`, error);
		return null;
	}
	const dynamicLocals = collectDynamicImportLocals(ast);
	if (dynamicLocals.size === 0) return null;
	const output = new MagicString(code);
	let changed = false;
	const pending = [];
	visitDynamicCalls(ast, dynamicLocals, (node) => {
		const args = getArray(node, "arguments");
		if (args.length > 2) throw new Error(`next/dynamic only accepts 2 arguments (${id}${formatNodeLocation(code, node)})`);
		const specifiers = collectImportSpecifiers(dynamicLoaderNode(args[0]));
		if (specifiers.length === 0) return;
		pending.push(resolveManifestModuleIds(specifiers, id, root, resolveDynamicImport).then((moduleIds) => {
			if (moduleIds.length === 0) return;
			if (applyLoadableGenerated(output, code, node, moduleIds)) changed = true;
		}));
	});
	await Promise.all(pending);
	if (!changed) return null;
	return {
		code: output.toString(),
		map: output.generateMap({ hires: "boundary" })
	};
}
function createDynamicPreloadMetadataPlugin() {
	let root = toSlash(process.cwd());
	return {
		name: "vinext:dynamic-preload-metadata",
		configResolved(config) {
			root = config.root;
		},
		transform: {
			filter: {
				id: {
					include: /\.(tsx?|jsx?|mjs)$/,
					exclude: /node_modules/
				},
				code: "next/dynamic"
			},
			async handler(code, id) {
				if (id.includes("node_modules") || id.startsWith("\0")) return null;
				if (!/\.(tsx?|jsx?|mjs)$/.test(id)) return null;
				const result = await transformNextDynamicPreloadMetadata(code, id, root, async (specifier, importer) => {
					return (await this.resolve(specifier, importer, { skipSelf: true }))?.id ?? null;
				});
				if (!result) return null;
				return result;
			}
		}
	};
}
//#endregion
export { createDynamicPreloadMetadataPlugin, transformNextDynamicPreloadMetadata };
