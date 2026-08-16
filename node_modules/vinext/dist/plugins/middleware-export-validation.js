import { createMiddlewareMissingExportError } from "../server/middleware-runtime.js";
import { stripViteModuleQuery } from "../utils/path.js";
import { parseAst } from "vite";
//#region src/plugins/middleware-export-validation.ts
function parserLanguage(id) {
	const cleanId = stripViteModuleQuery(id).toLowerCase();
	if (cleanId.endsWith(".tsx")) return "tsx";
	if (cleanId.endsWith(".ts") || cleanId.endsWith(".mts") || cleanId.endsWith(".cts")) return "ts";
	return "jsx";
}
function astName(value) {
	if (!value) return null;
	if (typeof value.name === "string") return value.name;
	if (typeof value.value === "string") return value.value;
	return null;
}
function hasValidMiddlewareModuleExport(source, id, isProxy) {
	const ast = parseAst(source, { lang: parserLanguage(id) });
	const expectedExport = isProxy ? "proxy" : "middleware";
	for (const statement of ast.body) {
		if (statement.type === "ExportDefaultDeclaration") return true;
		if (statement.type !== "ExportNamedDeclaration") continue;
		const declaration = statement.declaration;
		if (declaration?.type === "FunctionDeclaration" && astName(declaration.id) === expectedExport) return true;
		if (declaration?.type === "VariableDeclaration") {
			for (const declarator of declaration.declarations ?? []) if (astName(declarator.id) === expectedExport) return true;
		}
		for (const specifier of statement.specifiers ?? []) if (astName(specifier.exported ?? specifier.local) === expectedExport) return true;
	}
	return false;
}
function validateMiddlewareModuleExports(source, id, filePath, isProxy) {
	if (!hasValidMiddlewareModuleExport(source, id, isProxy)) throw createMiddlewareMissingExportError(filePath, isProxy);
}
//#endregion
export { hasValidMiddlewareModuleExport, validateMiddlewareModuleExports };
