import { parseAst } from "vite";
import MagicString from "magic-string";
//#region src/plugins/css-module-imports.ts
const CSS_MODULE_RE = /\.module\.(?:css|scss|sass)$/i;
const CSS_MODULE_HINT_RE = /\.module\.(?:css|scss|sass)/i;
const SCRIPT_RE = /\.(?:[cm]?[jt]sx?)(?:[?#].*)?$/i;
const MDX_RE = /\.mdx$/i;
function scriptLanguage(id) {
	const cleanId = id.split("?", 1)[0].toLowerCase();
	if (cleanId.endsWith(".tsx")) return "tsx";
	if (cleanId.endsWith(".ts") || cleanId.endsWith(".mts") || cleanId.endsWith(".cts")) return "ts";
	return "jsx";
}
function rewriteCssModuleNamespaceImports(code, lang = "js") {
	let ast;
	try {
		ast = parseAst(code, { lang });
	} catch {
		return null;
	}
	let output = null;
	for (const statement of ast.body) {
		if (statement.type !== "ImportDeclaration") continue;
		if (statement.importKind === "type") continue;
		if (typeof statement.source?.value !== "string") continue;
		if (!CSS_MODULE_RE.test(statement.source.value)) continue;
		if (statement.attributes && statement.attributes.length > 0) continue;
		if (statement.specifiers?.length !== 1) continue;
		const specifier = statement.specifiers[0];
		if (specifier.type !== "ImportNamespaceSpecifier") continue;
		if (typeof specifier.start !== "number" || typeof specifier.end !== "number") continue;
		if (typeof specifier.local?.name !== "string") continue;
		output ??= new MagicString(code);
		output.overwrite(specifier.start, specifier.end, specifier.local.name);
	}
	if (!output) return null;
	return {
		code: output.toString(),
		map: output.generateMap({ hires: true })
	};
}
function createCssModuleImportCompatibilityPlugin(options = {}) {
	const idFilter = options.compiledMdx ? MDX_RE : SCRIPT_RE;
	return {
		name: options.compiledMdx ? "vinext:css-module-import-compatibility-mdx" : "vinext:css-module-import-compatibility",
		enforce: options.compiledMdx ? "post" : "pre",
		transform: {
			filter: {
				id: idFilter,
				code: CSS_MODULE_HINT_RE
			},
			handler(code, id) {
				return rewriteCssModuleNamespaceImports(code, options.compiledMdx ? "jsx" : scriptLanguage(id));
			}
		}
	};
}
//#endregion
export { createCssModuleImportCompatibilityPlugin, rewriteCssModuleNamespaceImports };
