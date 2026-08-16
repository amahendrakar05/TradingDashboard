import { forEachAstChild, hasRange, isAstRecord, nodeArray } from "./ast-utils.js";
import { parseAst } from "vite";
import MagicString from "magic-string";
//#region src/plugins/require-context.ts
const TRANSFORMABLE_EXTENSIONS = /* @__PURE__ */ new Set([
	".js",
	".jsx",
	".ts",
	".tsx",
	".mjs",
	".cjs",
	".mts",
	".cts"
]);
function createRequireContextPlugin() {
	return {
		name: "vinext:require-context",
		enforce: "pre",
		transform: {
			filter: {
				id: /\.(?:[cm]?[jt]s|[jt]sx)(?:\?.*)?$/i,
				code: /\brequire\b[\s\S]*\.context/
			},
			handler(code, id) {
				const lang = langForId(id);
				let ast;
				try {
					ast = parseAst(code, { lang });
				} catch {
					return null;
				}
				const calls = collectRequireContextCalls(ast);
				if (calls.length === 0) return null;
				const output = new MagicString(code);
				for (const call of calls) output.overwrite(call.range.start, call.range.end, buildReplacement(call));
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
	switch (ext) {
		case ".ts":
		case ".cts":
		case ".mts": return "ts";
		case ".tsx": return "tsx";
		case ".jsx": return "jsx";
		default: return "jsx";
	}
}
function collectRequireContextCalls(ast) {
	const calls = [];
	function visit(value) {
		if (!isAstRecord(value)) return;
		const parsed = parseRequireContextCall(value);
		if (parsed) {
			calls.push(parsed);
			return;
		}
		forEachAstChild(value, visit);
	}
	visit(ast);
	return calls;
}
function parseRequireContextCall(node) {
	if (node.type !== "CallExpression" || !hasRange(node)) return null;
	const callee = node.callee;
	if (!isAstRecord(callee) || callee.type !== "MemberExpression" || callee.computed === true || callee.optional === true) return null;
	if (!isPropertyNamed(callee.property, "context")) return null;
	if (!isRequireExpression(callee.object)) return null;
	const args = nodeArray(node.arguments);
	const dir = stringLiteralValue(args[0]);
	if (dir == null || !(dir.startsWith("./") || dir.startsWith("../"))) return null;
	let recursive = true;
	if (args.length >= 2) {
		const value = booleanLiteralValue(args[1]);
		if (value == null) return null;
		recursive = value;
	}
	let pattern = "";
	let flags = "";
	if (args.length >= 3) {
		const regex = regexLiteralValue(args[2]);
		if (regex == null) return null;
		pattern = regex.pattern;
		flags = regex.flags;
	} else if (args.length > 3) return null;
	return {
		range: node,
		dir,
		recursive,
		pattern,
		flags
	};
}
function isRequireExpression(value) {
	let node = value;
	while (isAstRecord(node)) {
		if (node.type === "Identifier") return node.name === "require";
		if (node.type === "TSAsExpression" || node.type === "TSSatisfiesExpression") {
			node = node.expression;
			continue;
		}
		if (node.type === "TSNonNullExpression") {
			node = node.expression;
			continue;
		}
		if (node.type === "ParenthesizedExpression") {
			node = node.expression;
			continue;
		}
		return false;
	}
	return false;
}
function isPropertyNamed(value, name) {
	return isAstRecord(value) && value.type === "Identifier" && value.name === name;
}
function stringLiteralValue(value) {
	if (isAstRecord(value) && value.type === "Literal" && typeof value.value === "string") return value.value;
	return null;
}
function booleanLiteralValue(value) {
	if (isAstRecord(value) && value.type === "Literal" && typeof value.value === "boolean") return value.value;
	return null;
}
function regexLiteralValue(value) {
	if (!isAstRecord(value) || value.type !== "Literal") return null;
	const regex = value.regex;
	if (typeof regex === "object" && regex !== null && typeof regex.pattern === "string" && typeof regex.flags === "string") return {
		pattern: regex.pattern,
		flags: regex.flags
	};
	return null;
}
function buildReplacement(call) {
	const globPattern = globPatternFor(call.dir, call.recursive);
	const glob = `import.meta.glob(${JSON.stringify(globPattern)}, { eager: true })`;
	const base = JSON.stringify(stripTrailingSlash(call.dir));
	const filterFlags = call.flags.replace(/[gy]/g, "");
	const regexArgs = `${JSON.stringify(call.pattern)}, ${JSON.stringify(filterFlags)}`;
	return [
		"(() => {",
		`  const __modules = ${glob};`,
		`  const __base = ${base};`,
		`  const __re = ${call.pattern ? `new RegExp(${regexArgs})` : "null"};`,
		"  const __prefix = __base.endsWith('/') ? __base : __base + '/';",
		"  const __map = Object.create(null);",
		"  for (const __abs in __modules) {",
		"    if (!__abs.startsWith(__prefix)) continue;",
		"    const __key = './' + __abs.slice(__prefix.length);",
		"    if (__re && !__re.test(__key)) continue;",
		"    __map[__key] = __modules[__abs];",
		"  }",
		"  const __keys = Object.keys(__map).sort();",
		"  const __ctx = (__key) => {",
		"    if (__key in __map) return __map[__key];",
		"    const __err = new Error('Cannot find module \\'' + __key + '\\'');",
		"    __err.code = 'MODULE_NOT_FOUND';",
		"    throw __err;",
		"  };",
		"  __ctx.keys = () => __keys.slice();",
		"  __ctx.resolve = (__key) => __key;",
		`  __ctx.id = __base;`,
		"  return __ctx;",
		"})()"
	].join("\n");
}
function globPatternFor(dir, recursive) {
	const base = stripTrailingSlash(dir);
	return recursive ? `${base}/**/*` : `${base}/*`;
}
function stripTrailingSlash(value) {
	return value.endsWith("/") ? value.slice(0, -1) : value;
}
//#endregion
export { createRequireContextPlugin };
