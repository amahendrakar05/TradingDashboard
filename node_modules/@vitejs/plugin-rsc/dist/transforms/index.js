import { i as tinyassert } from "../dist-rz-Bnebz.js";
import { a as hasDirective, i as getExportNames, n as extractIdentifiers, o as validateNonAsyncFunction, r as extractNames, t as buildScopeTree } from "../scope-DKCDtt0O.js";
import MagicString from "magic-string";
import { walk } from "estree-walker";
//#region src/transforms/hoist.ts
function transformHoistInlineDirective(input, ast, { runtime, rejectNonAsyncFunction, ...options }) {
	if (!input.endsWith("\n")) input += "\n";
	const output = new MagicString(input);
	const directive = typeof options.directive === "string" ? exactRegex(options.directive) : options.directive;
	const scopeTree = buildScopeTree(ast);
	const names = [];
	walk(ast, { enter(node, parent) {
		if ((node.type === "FunctionExpression" || node.type === "FunctionDeclaration" || node.type === "ArrowFunctionExpression") && node.body.type === "BlockStatement") {
			const match = matchDirective(node.body.body, directive)?.match;
			if (!match) return;
			if (!node.async && rejectNonAsyncFunction) throw Object.assign(/* @__PURE__ */ new Error(`"${directive}" doesn't allow non async function`), { pos: node.start });
			const declName = node.type === "FunctionDeclaration" && node.id.name;
			const originalName = declName || parent?.type === "VariableDeclarator" && parent.id.type === "Identifier" && parent.id.name || "anonymous_server_function";
			const bindVars = getBindVars(node, scopeTree);
			let newParams = [...bindVars.map((b) => b.root), ...node.params.map((n) => input.slice(n.start, n.end))].join(", ");
			if (bindVars.length > 0 && options.decode) {
				newParams = ["$$hoist_encoded", ...node.params.map((n) => input.slice(n.start, n.end))].join(", ");
				output.appendLeft(node.body.body[0].start, `const [${bindVars.map((b) => b.root).join(",")}] = ${options.decode("$$hoist_encoded")};\n`);
			}
			const newName = `$$hoist_${names.length}` + (originalName ? `_${originalName}` : "");
			names.push(newName);
			output.update(node.start, node.body.start, `\n;${options.noExport ? "" : "export "}${node.async ? "async " : ""}function${node.generator ? "*" : ""} ${newName}(${newParams}) `);
			output.appendLeft(node.end, `;\n/* #__PURE__ */ Object.defineProperty(${newName}, "name", { value: ${JSON.stringify(originalName)} });\n`);
			output.move(node.start, node.end, input.length);
			let newCode = `/* #__PURE__ */ ${runtime(newName, newName, { directiveMatch: match })}`;
			if (bindVars.length > 0) {
				const bindArgs = options.encode ? options.encode("[" + bindVars.map((b) => b.expr).join(", ") + "]") : bindVars.map((b) => b.expr).join(", ");
				newCode = `${newCode}.bind(null, ${bindArgs})`;
			}
			if (declName) {
				newCode = `const ${declName} = ${newCode};`;
				if (parent?.type === "ExportDefaultDeclaration") {
					output.remove(parent.start, node.start);
					newCode = `${newCode}\nexport default ${declName};`;
				}
			}
			output.appendLeft(node.start, newCode);
		}
	} });
	return {
		output,
		names
	};
}
const exactRegex = (s) => new RegExp("^" + s.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&") + "$");
function matchDirective(body, directive) {
	for (const stmt of body) if (stmt.type === "ExpressionStatement" && stmt.expression.type === "Literal" && typeof stmt.expression.value === "string") {
		const match = stmt.expression.value.match(directive);
		if (match) return {
			match,
			node: stmt.expression
		};
	}
}
function findDirectives(ast, directive) {
	const directiveRE = exactRegex(directive);
	const nodes = [];
	walk(ast, { enter(node) {
		if (node.type === "Program" || node.type === "BlockStatement") {
			const match = matchDirective(node.body, directiveRE);
			if (match) nodes.push(match.node);
		}
	} });
	return nodes;
}
function getBindVars(fn, scopeTree) {
	const fnScope = scopeTree.nodeScope.get(fn);
	const ancestorScopes = fnScope.getAncestorScopes();
	const bindReferences = (scopeTree.scopeToReferences.get(fnScope) ?? []).filter((id) => {
		const scope = scopeTree.referenceToDeclaredScope.get(id);
		return scope && scope !== scopeTree.moduleScope && ancestorScopes.has(scope);
	});
	const accessMap = {};
	for (const id of bindReferences) {
		const name = id.name;
		const node = scopeTree.referenceToNode.get(id);
		if (node.type === "Identifier") {
			accessMap[name] = { kind: "bare" };
			continue;
		}
		accessMap[name] ??= {
			kind: "paths",
			paths: []
		};
		const entry = accessMap[name];
		if (entry.kind === "paths") {
			const path = memberExpressionToPath(node);
			if (!entry.paths.some((existing) => existing.key === path.key)) entry.paths.push(path);
		}
	}
	const result = [];
	for (const [root, entry] of Object.entries(accessMap)) {
		if (entry.kind === "bare") {
			result.push({
				root,
				expr: root
			});
			continue;
		}
		result.push({
			root,
			expr: synthesizePartialObject(root, entry.paths)
		});
	}
	return result;
}
function memberExpressionToPath(node) {
	const segments = [];
	let current = node;
	while (current.type === "MemberExpression") {
		tinyassert(current.property.type === "Identifier");
		segments.unshift(current.property.name);
		tinyassert(current.object.type === "Identifier" || current.object.type === "MemberExpression");
		current = current.object;
	}
	return {
		key: segments.join("."),
		segments
	};
}
function synthesizePartialObject(root, bindPaths) {
	const trie = /* @__PURE__ */ new Map();
	const paths = dedupeByPrefix(bindPaths.map((p) => p.segments));
	for (const path of paths) {
		let node = trie;
		for (let i = 0; i < path.length; i++) {
			const segment = path[i];
			let child = node.get(segment);
			if (!child) {
				child = /* @__PURE__ */ new Map();
				node.set(segment, child);
			}
			node = child;
		}
	}
	function serialize(node, segments) {
		if (node.size === 0) return root + segments.map((segment) => `.${segment}`).join("");
		const entries = [];
		for (const [key, child] of node) {
			const safeKey = key === "__proto__" ? `["__proto__"]` : key;
			entries.push(`${safeKey}: ${serialize(child, [...segments, key])}`);
		}
		return `{ ${entries.join(", ")} }`;
	}
	return serialize(trie, []);
}
function dedupeByPrefix(paths) {
	const sorted = [...paths].sort((a, b) => a.length - b.length);
	const result = [];
	for (const path of sorted) if (!result.some((existingPath) => existingPath.every((segment, i) => segment === path[i]))) result.push(path);
	return result;
}
//#endregion
//#region src/transforms/wrap-export.ts
function transformWrapExport(input, ast, options) {
	const output = new MagicString(input);
	const exportNames = [];
	const toAppend = [];
	const filter = options.filter ?? (() => true);
	function wrapSimple(start, end, exports) {
		exportNames.push(...exports.map((e) => e.name));
		const newCode = exports.map((e) => [filter(e.name, e.meta) && `${e.name} = /* #__PURE__ */ ${options.runtime(e.name, e.name, e.meta)};\n`, `export { ${e.name} };\n`]).flat().filter(Boolean).join("");
		output.update(start, end, newCode);
		output.move(start, end, input.length);
	}
	function wrapExport(name, exportName, meta = {}) {
		exportNames.push(exportName);
		if (!filter(exportName, meta)) {
			toAppend.push(`export { ${name} as ${exportName} }`);
			return;
		}
		toAppend.push(`const $$wrap_${name} = /* #__PURE__ */ ${options.runtime(name, exportName, meta)}`, `export { $$wrap_${name} as ${exportName} }`);
	}
	for (const node of ast.body) {
		if (node.type === "ExportNamedDeclaration") if (node.declaration) if (node.declaration.type === "FunctionDeclaration" || node.declaration.type === "ClassDeclaration") {
			/**
			* export function foo() {}
			*/
			validateNonAsyncFunction(options, node.declaration);
			const name = node.declaration.id.name;
			wrapSimple(node.start, node.declaration.start, [{
				name,
				meta: {
					isFunction: true,
					declName: name
				}
			}]);
		} else if (node.declaration.type === "VariableDeclaration") {
			/**
			* export const foo = 1, bar = 2
			*/
			for (const decl of node.declaration.declarations) if (decl.init) validateNonAsyncFunction(options, decl.init);
			if (node.declaration.kind === "const") output.update(node.declaration.start, node.declaration.start + 5, "let");
			const names = node.declaration.declarations.flatMap((decl) => extractNames(decl.id));
			let isFunction = false;
			if (node.declaration.declarations.length === 1) {
				const decl = node.declaration.declarations[0];
				isFunction = decl.id.type === "Identifier" && (decl.init?.type === "ArrowFunctionExpression" || decl.init?.type === "FunctionExpression");
			}
			wrapSimple(node.start, node.declaration.start, names.map((name) => ({
				name,
				meta: {
					isFunction,
					declName: name
				}
			})));
		} else node.declaration;
		else if (node.source) {
			/**
			* export { foo, bar as car } from './foo'
			*/
			output.remove(node.start, node.end);
			for (const spec of node.specifiers) {
				tinyassert(spec.local.type === "Identifier");
				tinyassert(spec.exported.type === "Identifier");
				const name = spec.local.name;
				toAppend.push(`import { ${name} as $$import_${name} } from ${node.source.raw}`);
				wrapExport(`$$import_${name}`, spec.exported.name);
			}
		} else {
			/**
			* export { foo, bar as car }
			*/
			output.remove(node.start, node.end);
			for (const spec of node.specifiers) {
				tinyassert(spec.local.type === "Identifier");
				tinyassert(spec.exported.type === "Identifier");
				wrapExport(spec.local.name, spec.exported.name);
			}
		}
		/**
		* export * from './foo'
		*/
		if (!options.ignoreExportAllDeclaration && node.type === "ExportAllDeclaration") throw Object.assign(/* @__PURE__ */ new Error("unsupported ExportAllDeclaration"), { pos: node.start });
		/**
		* export default function foo() {}
		* export default class Foo {}
		* export default () => {}
		*/
		if (node.type === "ExportDefaultDeclaration") {
			validateNonAsyncFunction(options, node.declaration);
			let localName;
			let isFunction = false;
			let declName;
			let defaultExportIdentifierName;
			if ((node.declaration.type === "FunctionDeclaration" || node.declaration.type === "ClassDeclaration") && node.declaration.id) {
				localName = node.declaration.id.name;
				output.remove(node.start, node.declaration.start);
				isFunction = node.declaration.type === "FunctionDeclaration";
				declName = node.declaration.id.name;
			} else {
				localName = "$$default";
				output.update(node.start, node.declaration.start, "const $$default = ");
				if (node.declaration.type === "Identifier") defaultExportIdentifierName = node.declaration.name;
			}
			wrapExport(localName, "default", {
				isFunction,
				declName,
				defaultExportIdentifierName
			});
		}
	}
	if (toAppend.length > 0) output.append([
		"",
		...toAppend,
		""
	].join(";\n"));
	return {
		exportNames,
		output
	};
}
//#endregion
//#region src/transforms/proxy-export.ts
function transformDirectiveProxyExport(ast, options) {
	if (!hasDirective(ast.body, options.directive)) return;
	return transformProxyExport(ast, options);
}
function transformProxyExport(ast, options) {
	if (options.keep && typeof options.code !== "string") throw new Error("`keep` option requires `code`");
	const output = new MagicString(options.code ?? " ".repeat(ast.end));
	const exportNames = [];
	function createExport(node, names) {
		exportNames.push(...names);
		const newCode = names.map((name) => (name === "default" ? `export default` : `export const ${name} =`) + ` /* #__PURE__ */ ${options.runtime(name)};\n`).join("");
		output.update(node.start, node.end, newCode);
	}
	for (const node of ast.body) {
		if (node.type === "ExportNamedDeclaration") {
			if (node.declaration) if (node.declaration.type === "FunctionDeclaration" || node.declaration.type === "ClassDeclaration") {
				/**
				* export function foo() {}
				*/
				validateNonAsyncFunction(options, node.declaration);
				createExport(node, [node.declaration.id.name]);
			} else if (node.declaration.type === "VariableDeclaration") {
				/**
				* export const foo = 1, bar = 2
				*/
				for (const decl of node.declaration.declarations) if (decl.init) validateNonAsyncFunction(options, decl.init);
				if (options.keep && options.code) {
					if (node.declaration.declarations.length === 1) {
						const decl = node.declaration.declarations[0];
						if (decl.id.type === "Identifier" && decl.init) {
							const name = decl.id.name;
							const value = options.code.slice(decl.init.start, decl.init.end);
							const newCode = `export const ${name} = /* #__PURE__ */ ${options.runtime(name, { value })};`;
							output.update(node.start, node.end, newCode);
							exportNames.push(name);
							continue;
						}
					}
				}
				createExport(node, node.declaration.declarations.flatMap((decl) => extractNames(decl.id)));
			} else node.declaration;
			else {
				/**
				* export { foo, bar as car } from './foo'
				* export { foo, bar as car }
				*/
				const names = [];
				for (const spec of node.specifiers) {
					tinyassert(spec.exported.type === "Identifier");
					names.push(spec.exported.name);
				}
				createExport(node, names);
			}
			continue;
		}
		/**
		* export * from './foo'
		*/
		if (!options.ignoreExportAllDeclaration && node.type === "ExportAllDeclaration") throw new Error("unsupported ExportAllDeclaration");
		/**
		* export default function foo() {}
		* export default class Foo {}
		* export default () => {}
		*/
		if (node.type === "ExportDefaultDeclaration") {
			validateNonAsyncFunction(options, node.declaration);
			createExport(node, ["default"]);
			continue;
		}
		if (options.keep) continue;
		output.remove(node.start, node.end);
	}
	return {
		exportNames,
		output
	};
}
//#endregion
//#region src/transforms/server-action.ts
function transformServerActionServer(input, ast, options) {
	if (hasDirective(ast.body, "use server")) return transformWrapExport(input, ast, options);
	return transformHoistInlineDirective(input, ast, {
		...options,
		directive: "use server"
	});
}
//#endregion
export { extractIdentifiers, extractNames, findDirectives, getExportNames, hasDirective, transformDirectiveProxyExport, transformHoistInlineDirective, transformProxyExport, transformServerActionServer, transformWrapExport, validateNonAsyncFunction };
