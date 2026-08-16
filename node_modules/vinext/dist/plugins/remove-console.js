import { parseAst } from "vite";
import MagicString from "magic-string";
//#region src/plugins/remove-console.ts
/**
* Strip `console.*` calls from client bundle code.
*
* Mirrors Next.js's SWC `remove_console` transform:
*   - Strips all `console.<method>()` calls regardless of context (top-level,
*     JSX expressions, function arguments, return values, ternary branches)
*   - Replaces removed calls with `void 0` to keep the AST valid in every
*     position a CallExpression can appear
*   - Respects `exclude: ["error"]` to preserve certain methods (case-insensitive)
*   - Preserves calls when `console` is shadowed (local variable, function
*     parameter, or destructured binding)
*   - Preserves computed property access `console[prop]()`
*
* Uses Vite's `parseAst` (OXC/acorn) for parsing and `MagicString` for
* surgical source replacement. Returns `null` when no changes are made.
*/
const SCOPE_ENTERING_TYPES = /* @__PURE__ */ new Set([
	"FunctionDeclaration",
	"FunctionExpression",
	"ArrowFunctionExpression"
]);
/**
* Walk the AST body looking for expression statements whose expression is a
* CallExpression with a callee of `console.<identifier>`. When found, check
* that the name is not in the excluded set and that `console` is not shadowed
* at this scope. If all conditions pass, replace the entire statement with `;`.
*
* Returns `null` if no console calls are removed.
*/
function removeConsoleCalls(code, config) {
	if (config === false) return null;
	if (!code.match(/\bconsole\b/)) return null;
	let ast;
	try {
		ast = parseAst(code);
	} catch {
		return null;
	}
	const excluded = typeof config === "object" ? new Set(config.exclude.map((s) => s.toLowerCase())) : /* @__PURE__ */ new Set();
	const scopeStack = [{ shadowed: false }];
	function currentScope() {
		return scopeStack[scopeStack.length - 1];
	}
	function pushScope() {
		scopeStack.push({ shadowed: currentScope().shadowed });
	}
	function popScope() {
		scopeStack.pop();
	}
	const s = new MagicString(code);
	let changed = false;
	/**
	* Check if a node introduces a binding named "console" and mark scope.
	* Recurses into all binding-pattern node types (destructuring shapes,
	* defaults, rest elements).
	*/
	function checkBinding(node) {
		if (!node) return;
		switch (node.type) {
			case "Identifier":
				if (node.name === "console") currentScope().shadowed = true;
				break;
			case "ObjectPattern":
				for (const prop of node.properties) checkBinding(prop);
				break;
			case "Property": {
				const propertyNode = node;
				if (propertyNode.value) checkBinding(propertyNode.value);
				break;
			}
			case "ArrayPattern": {
				const elements = node.elements;
				if (elements) for (const el of elements) checkBinding(el);
				break;
			}
			case "AssignmentPattern": {
				const left = node.left;
				checkBinding(left);
				break;
			}
			case "RestElement": {
				const argument = node.argument;
				checkBinding(argument);
				break;
			}
			default: break;
		}
	}
	/**
	* Check if an identifier refers to the *global* console.
	* It's global only when:
	*   1. Its name is "console"
	*   2. No local binding of that name shadows it at this point
	*/
	function isGlobalConsole(node) {
		return node.type === "Identifier" && node.name === "console" && !currentScope().shadowed;
	}
	/**
	* Determine if a call expression is a `console.<method>()` that should be
	* removed. The callee must be a MemberExpression with:
	*   - object: Identifier "console" (global, not shadowed)
	*   - property: Identifier (NOT computed — computed access like
	*     `console[prop]()` is preserved per Next.js behavior)
	* The method name must NOT be in the excluded set.
	*/
	function shouldRemove(node) {
		if (node.type !== "CallExpression") return false;
		const callee = node.callee;
		if (callee.type !== "MemberExpression") return false;
		if (callee.computed) return false;
		if (!isGlobalConsole(callee.object)) return false;
		const prop = callee.property;
		if (prop.type !== "Identifier") return false;
		const method = prop.name.toLowerCase();
		if (excluded.has(method)) return false;
		return true;
	}
	/**
	* Recursively walk a node tree, managing scope for shadow detection.
	* When a CallExpression matches `console.<method>()`, replace it with
	* `void 0`. If the call is the sole expression of an ExpressionStatement,
	* replace the entire statement with `;` for cleaner output.
	*/
	function walk(node, parent) {
		if (!node) return;
		if (node.type === "CallExpression" && shouldRemove(node)) {
			if (parent?.type === "ExpressionStatement") s.overwrite(parent.start, parent.end, ";");
			else s.overwrite(node.start, node.end, "void 0");
			changed = true;
			return;
		}
		if (node.type === "FunctionDeclaration" || node.type === "ClassDeclaration") {
			const id = node.id;
			checkBinding(id);
		}
		const isScopeEntering = SCOPE_ENTERING_TYPES.has(node.type);
		if (isScopeEntering) {
			pushScope();
			if (node.type === "FunctionExpression") {
				const id = node.id;
				checkBinding(id);
			}
			const params = node.params;
			if (params) for (const param of params) checkBinding(param);
		}
		const isCatchScope = node.type === "CatchClause";
		if (isCatchScope) {
			pushScope();
			const param = node.param;
			if (param) checkBinding(param);
		}
		const isBlockScope = node.type === "BlockStatement" || node.type === "Program" || node.type === "SwitchCase";
		if (isBlockScope && !isScopeEntering) pushScope();
		if (node.type === "VariableDeclaration") for (const decl of node.declarations ?? []) checkBinding(decl.id);
		for (const key of Object.keys(node)) {
			if (key === "parent" || key === "start" || key === "end") continue;
			const child = node[key];
			if (child && typeof child === "object") {
				if (Array.isArray(child)) {
					for (const item of child) if (item && typeof item === "object" && "type" in item) walk(item, node);
				} else if ("type" in child) walk(child, node);
			}
		}
		if (isScopeEntering || isBlockScope || isCatchScope) popScope();
	}
	for (const node of ast.body) walk(node);
	if (!changed) return null;
	return {
		code: s.toString(),
		map: s.generateMap({ hires: "boundary" })
	};
}
//#endregion
export { removeConsoleCalls };
