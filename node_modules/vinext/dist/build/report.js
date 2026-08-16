import { toSlash } from "../deps/.pnpm/pathslash@0.1.0/deps/pathslash/dist/index.js";
import { findDir } from "../utils/project.js";
import fs from "node:fs";
import { parseSync } from "vite";
//#region src/build/report.ts
/**
* Build report — prints a Next.js-style route table after `vinext build`.
*
* Classifies every discovered route as:
*   ○  Static   — confirmed static: force-static or revalidate=Infinity
*   ◐  ISR      — statically rendered, revalidated on a timer (revalidate=N)
*   ƒ  Dynamic  — confirmed dynamic: force-dynamic, revalidate=0, or getServerSideProps
*   ?  Unknown  — no explicit config; likely dynamic but not confirmed
*   λ  API      — API route handler
*
* Classification uses AST-based static source analysis (no module execution).
* Runtime/prerender results are still treated as stronger evidence where
* available; AST analysis only reads top-level static exports.
*
* Limitation: without running the build, we cannot detect dynamic API usage
* (headers(), cookies(), connection(), etc.) that implicitly forces a route
* dynamic. Routes without explicit `export const dynamic` or
* `export const revalidate` are classified as "unknown" rather than "static"
* to avoid false confidence.
*/
const UNSUPPORTED_STATIC_VALUE = Symbol("unsupported static value");
function getAppRouteRenderEntryPath(route) {
	if (route.pagePath) return route.pagePath;
	if (route.routePath) return null;
	for (const slot of route.parallelSlots) if (slot.pagePath) return slot.pagePath;
	for (const slot of route.parallelSlots) if (slot.defaultPath) return slot.defaultPath;
	return null;
}
function parseRouteModuleWithLang(code, lang) {
	try {
		const result = parseSync(`vinext-route.${lang}`, code, {
			astType: "ts",
			lang,
			sourceType: "module"
		});
		return result.errors.some((error) => error.severity === "Error") ? null : result.program;
	} catch {
		return null;
	}
}
function parseRouteModule(code) {
	return parseRouteModuleWithLang(code, "tsx") ?? parseRouteModuleWithLang(code, "ts");
}
function moduleExportNameValue(name) {
	if (name.type === "Identifier") return name.name;
	if (name.type === "Literal" && typeof name.value === "string") return name.value;
	return null;
}
function bindingName(pattern) {
	return pattern.type === "Identifier" ? pattern.name : null;
}
function declarationHasBindingName(declaration, name) {
	if (declaration === null) return false;
	if (declaration.type === "FunctionDeclaration") return declaration.id?.name === name;
	if (declaration.type !== "VariableDeclaration") return false;
	return declaration.declarations.some((declaration) => bindingName(declaration.id) === name);
}
/**
* Returns true if the source code contains an export declaration with the given name.
* For re-export specifiers, this intentionally follows Next.js' static analyzer
* and checks the local/original binding name.
* Handles all three common export forms:
*   export function foo() {}
*   export const foo = ...
*   export { foo }
*/
function hasNamedExport(code, name) {
	const program = parseRouteModule(code);
	if (!program) return false;
	return hasNamedExportInProgram(program, name);
}
/** Returns true when Next.js' analyzer recognizes the requested export name. */
function hasExportedName(code, name) {
	const program = parseRouteModule(code);
	if (!program) return false;
	for (const node of program.body) {
		if (node.type !== "ExportNamedDeclaration") continue;
		if (node.exportKind === "type") continue;
		if (declarationHasBindingName(node.declaration, name)) return true;
		for (const specifier of node.specifiers) {
			if (specifier.exportKind === "type") continue;
			if (moduleExportNameValue(specifier.local) === name) return true;
		}
	}
	return false;
}
function hasNamedExportInProgram(program, name) {
	for (const node of program.body) {
		if (node.type !== "ExportNamedDeclaration") continue;
		if (declarationHasBindingName(node.declaration, name)) return true;
		for (const specifier of node.specifiers) if (moduleExportNameValue(specifier.local) === name) return true;
	}
	return false;
}
function unwrapStaticExpression(expression) {
	let current = expression;
	while (current.type === "ParenthesizedExpression" || current.type === "TSAsExpression" || current.type === "TSSatisfiesExpression" || current.type === "TSTypeAssertion" || current.type === "TSNonNullExpression") current = current.expression;
	return current;
}
function findExportedConstInitializer(code, name) {
	const program = parseRouteModule(code);
	if (!program) return null;
	return findExportedConstInitializerInProgram(program, name);
}
function findExportedConstInitializerInProgram(program, name) {
	for (const node of program.body) {
		if (node.type !== "ExportNamedDeclaration") continue;
		const declaration = node.declaration;
		if (declaration?.type !== "VariableDeclaration" || declaration.kind !== "const") continue;
		for (const declarator of declaration.declarations) if (bindingName(declarator.id) === name) return declarator.init;
	}
	return null;
}
/**
* Extracts the string value of `export const <name> = "value"`.
* Handles TypeScript annotations/assertions and no-substitution template literals.
* Returns null if the export is absent or not a string literal.
*/
function extractExportConstString(code, name) {
	return extractStringFromConstInitializer(findExportedConstInitializer(code, name));
}
function extractExportConstStringFromProgram(program, name) {
	return extractStringFromConstInitializer(findExportedConstInitializerInProgram(program, name));
}
function extractStringFromConstInitializer(initializer) {
	if (initializer === null) return null;
	const expression = unwrapStaticExpression(initializer);
	if (expression.type === "Literal" && typeof expression.value === "string") return expression.value;
	if (expression.type === "TemplateLiteral" && expression.expressions.length === 0) return expression.quasis[0]?.value.cooked ?? expression.quasis[0]?.value.raw ?? null;
	return null;
}
function extractMiddlewareMatcherConfig(filePath) {
	const value = extractMiddlewareMatcherConfigValue(filePath);
	return isStaticMiddlewareMatcher(value) ? value : void 0;
}
/**
* Extract the statically analyzable `config.matcher` value without first
* narrowing it to vinext's runtime matcher type. Build validation needs the
* raw value so malformed matcher objects are rejected instead of disappearing
* as though no matcher had been configured.
*/
function extractMiddlewareMatcherConfigValue(filePath) {
	let code;
	try {
		code = fs.readFileSync(filePath, "utf8");
	} catch {
		return;
	}
	const initializer = findExportedConstInitializer(code, "config");
	if (!initializer) return void 0;
	const config = unwrapStaticExpression(initializer);
	if (config.type !== "ObjectExpression") return void 0;
	const matcherExpression = objectPropertyValue(config, "matcher");
	if (!matcherExpression) return void 0;
	const value = extractStaticJsonValue(matcherExpression);
	return value === UNSUPPORTED_STATIC_VALUE ? void 0 : value;
}
function objectPropertyValue(object, key) {
	for (const property of object.properties) {
		if (property.type !== "Property" || property.computed) continue;
		if (propertyKeyName(property.key) !== key) continue;
		return property.value;
	}
	return null;
}
function propertyKeyName(key) {
	if (key.type === "Identifier") return key.name;
	if (key.type === "Literal" && typeof key.value === "string") return key.value;
	return null;
}
function extractStaticJsonValue(expression) {
	const value = unwrapStaticExpression(expression);
	if (value.type === "Literal") {
		if (typeof value.value === "string" || typeof value.value === "number" || typeof value.value === "boolean" || value.value === null) return value.value;
		return UNSUPPORTED_STATIC_VALUE;
	}
	if (value.type === "TemplateLiteral" && value.expressions.length === 0) return value.quasis[0]?.value.cooked ?? value.quasis[0]?.value.raw ?? "";
	if (value.type === "ArrayExpression") {
		const items = [];
		for (const element of value.elements) {
			if (!element || element.type === "SpreadElement") return UNSUPPORTED_STATIC_VALUE;
			const item = extractStaticJsonValue(element);
			if (item === UNSUPPORTED_STATIC_VALUE) return UNSUPPORTED_STATIC_VALUE;
			items.push(item);
		}
		return items;
	}
	if (value.type === "ObjectExpression") {
		const object = {};
		for (const property of value.properties) {
			if (property.type !== "Property" || property.computed) return UNSUPPORTED_STATIC_VALUE;
			const key = propertyKeyName(property.key);
			if (!key) return UNSUPPORTED_STATIC_VALUE;
			const propertyValue = extractStaticJsonValue(property.value);
			if (propertyValue === UNSUPPORTED_STATIC_VALUE) return UNSUPPORTED_STATIC_VALUE;
			object[key] = propertyValue;
		}
		return object;
	}
	return UNSUPPORTED_STATIC_VALUE;
}
function isStaticMiddlewareMatcher(value) {
	if (typeof value === "string") return true;
	if (!Array.isArray(value)) return false;
	return value.every((item) => typeof item === "string" || isStaticMiddlewareMatcherObject(item));
}
function isStaticMiddlewareMatcherObject(value) {
	if (!value || typeof value !== "object" || Array.isArray(value)) return false;
	const record = value;
	if (typeof record.source !== "string") return false;
	if (record.locale !== void 0 && record.locale !== false) return false;
	return isStaticMatcherConditions(record.has) && isStaticMatcherConditions(record.missing);
}
function isStaticMatcherConditions(value) {
	if (value === void 0) return true;
	if (!Array.isArray(value)) return false;
	return value.every((item) => {
		if (!item || typeof item !== "object" || Array.isArray(item)) return false;
		return Object.values(item).every((entry) => typeof entry === "string");
	});
}
/**
* Extracts the numeric value of `export const <name> = <number|false>`.
* Supports integers, decimals, negative values, `Infinity`, and `false`.
* `false` is returned as `Infinity` because `export const revalidate = false`
* means "cache indefinitely" in Next.js segment config.
* Handles TypeScript annotations/assertions and JavaScript numeric separators.
* Returns null if the export is absent or not a number/`false`.
*/
function extractExportConstNumber(code, name) {
	return extractNumberFromConstInitializer(findExportedConstInitializer(code, name));
}
function extractExportConstNumberFromProgram(program, name) {
	return extractNumberFromConstInitializer(findExportedConstInitializerInProgram(program, name));
}
function extractNumberFromConstInitializer(initializer) {
	if (initializer === null) return null;
	const value = extractStaticNumberValue(initializer);
	if (value === null) return null;
	return value === false ? Infinity : value;
}
/**
* Extracts the `revalidate` value from inside a `getStaticProps` return object.
* Looks for:  revalidate: <number>  or  revalidate: false  or  revalidate: Infinity
*
* Returns:
*   number   — a positive revalidation interval (enables ISR)
*   0        — treat as SSR (revalidate every request)
*   false    — fully static (no revalidation)
*   Infinity — fully static (treated same as false by Next.js)
*   null     — no `revalidate` key found (fully static)
*/
function extractGetStaticPropsRevalidate(code) {
	const program = parseRouteModule(code);
	if (!program) return extractWrappedGetStaticPropsRevalidate(code);
	return extractGetStaticPropsRevalidateFromProgram(program, code);
}
function extractGetStaticPropsRevalidateFromProgram(program, fallbackCode) {
	const getStaticProps = findExportedGetStaticProps(program);
	if (getStaticProps === "external") return null;
	if (getStaticProps === null) return extractWrappedGetStaticPropsRevalidate(fallbackCode);
	return extractFunctionRevalidate(getStaticProps);
}
function extractStaticNumberValue(expression) {
	const unwrapped = unwrapStaticExpression(expression);
	if (unwrapped.type === "Literal") {
		if (typeof unwrapped.value === "number") return unwrapped.value;
		if (unwrapped.value === false) return false;
		return null;
	}
	if (unwrapped.type === "Identifier" && unwrapped.name === "Infinity") return Infinity;
	if (unwrapped.type === "UnaryExpression") {
		const argument = extractStaticNumberValue(unwrapped.argument);
		if (typeof argument !== "number") return null;
		if (unwrapped.operator === "-") return -argument;
		if (unwrapped.operator === "+") return argument;
		return null;
	}
	return null;
}
function findExportedGetStaticProps(program) {
	let hasLocalGetStaticPropsExport = false;
	for (const node of program.body) {
		if (node.type !== "ExportNamedDeclaration") continue;
		const declaration = node.declaration;
		if (declaration?.type === "FunctionDeclaration" && declaration.id?.name === "getStaticProps") return declaration;
		if (declaration?.type === "VariableDeclaration") {
			const direct = findFunctionLikeVariable(declaration.declarations, "getStaticProps");
			if (direct) return direct;
		}
		for (const specifier of node.specifiers) {
			if (moduleExportNameValue(specifier.local) !== "getStaticProps") continue;
			if (node.source !== null) return "external";
			hasLocalGetStaticPropsExport = true;
		}
	}
	if (!hasLocalGetStaticPropsExport) return null;
	for (const node of program.body) {
		if (node.type === "FunctionDeclaration" && node.id?.name === "getStaticProps") return node;
		if (node.type === "VariableDeclaration") {
			const local = findFunctionLikeVariable(node.declarations, "getStaticProps");
			if (local) return local;
		}
	}
	return null;
}
function findFunctionLikeVariable(declarations, name) {
	for (const declaration of declarations) {
		if (bindingName(declaration.id) !== name || declaration.init === null) continue;
		const initializer = unwrapStaticExpression(declaration.init);
		if (initializer.type === "FunctionExpression" || initializer.type === "ArrowFunctionExpression") return initializer;
	}
	return null;
}
function extractWrappedGetStaticPropsRevalidate(code) {
	const program = parseRouteModule(`function __vinextGetStaticProps() {\n${code}\n}`);
	if (!program) return null;
	for (const node of program.body) if (node.type === "FunctionDeclaration" && node.id?.name === "__vinextGetStaticProps") return extractFunctionRevalidate(node);
	return null;
}
function extractFunctionRevalidate(fn) {
	if (fn.type === "ArrowFunctionExpression" && fn.body.type !== "BlockStatement") {
		const expression = unwrapStaticExpression(fn.body);
		return expression.type === "ObjectExpression" ? extractObjectRevalidate(expression) : null;
	}
	if (!fn.body || fn.body.type !== "BlockStatement") return null;
	return extractBlockRevalidate(fn.body);
}
function extractBlockRevalidate(block) {
	for (const statement of block.body) {
		const result = extractStatementRevalidate(statement);
		if (result !== null) return result;
	}
	return null;
}
function extractStatementRevalidate(statement) {
	if (statement.type === "ReturnStatement") {
		if (!statement.argument) return null;
		const argument = unwrapStaticExpression(statement.argument);
		return argument.type === "ObjectExpression" ? extractObjectRevalidate(argument) : null;
	}
	if (statement.type === "BlockStatement") return extractBlockRevalidate(statement);
	if (statement.type === "IfStatement") return extractStatementRevalidate(statement.consequent) ?? (statement.alternate ? extractStatementRevalidate(statement.alternate) : null);
	if (statement.type === "ForStatement" || statement.type === "ForInStatement" || statement.type === "ForOfStatement" || statement.type === "WhileStatement" || statement.type === "DoWhileStatement" || statement.type === "WithStatement" || statement.type === "LabeledStatement") return extractStatementRevalidate(statement.body);
	if (statement.type === "SwitchStatement") {
		for (const switchCase of statement.cases) for (const consequent of switchCase.consequent) {
			const result = extractStatementRevalidate(consequent);
			if (result !== null) return result;
		}
		return null;
	}
	if (statement.type === "TryStatement") return extractBlockRevalidate(statement.block) ?? (statement.handler ? extractBlockRevalidate(statement.handler.body) : null) ?? (statement.finalizer ? extractBlockRevalidate(statement.finalizer) : null);
	return null;
}
function extractObjectRevalidate(object) {
	for (const property of object.properties) {
		if (property.type !== "Property" || property.computed || propertyName(property.key) !== "revalidate") continue;
		return extractStaticNumberValue(property.value);
	}
	return null;
}
function propertyName(key) {
	if (key.type === "Identifier") return key.name;
	if (key.type === "Literal" && typeof key.value === "string") return key.value;
	return null;
}
/**
* Classifies a layout file by its segment config exports (`dynamic`, `revalidate`).
*
* Returns a tagged `LayoutBuildClassification` carrying both the decision and
* the specific segment-config field that produced it. `{ kind: "absent" }`
* means no segment config is present and the caller should defer to the next
* layer (module graph analysis).
*
* Unlike page classification, positive `revalidate` values are not meaningful
* for layout skip decisions — ISR is a page-level concept. Only the extremes
* (`revalidate = 0` → dynamic, `revalidate = Infinity` → static) are decisive.
*/
function classifyLayoutSegmentConfig(code) {
	const program = parseRouteModule(code);
	const dynamicValue = program ? extractExportConstStringFromProgram(program, "dynamic") : null;
	if (dynamicValue === "force-dynamic") return {
		kind: "dynamic",
		reason: {
			layer: "segment-config",
			key: "dynamic",
			value: "force-dynamic"
		}
	};
	if (dynamicValue === "force-static" || dynamicValue === "error") return {
		kind: "static",
		reason: {
			layer: "segment-config",
			key: "dynamic",
			value: dynamicValue
		}
	};
	const revalidateValue = program ? extractExportConstNumberFromProgram(program, "revalidate") : null;
	if (revalidateValue === Infinity) return {
		kind: "static",
		reason: {
			layer: "segment-config",
			key: "revalidate",
			value: Infinity
		}
	};
	if (revalidateValue === 0) return {
		kind: "dynamic",
		reason: {
			layer: "segment-config",
			key: "revalidate",
			value: 0
		}
	};
	return { kind: "absent" };
}
/**
* Classifies a Pages Router page file by reading its source and examining
* which data-fetching exports it contains.
*
* API routes (files under pages/api/) are always `api`.
*/
function classifyPagesRoute(filePath) {
	if (toSlash(filePath).includes("/pages/api/")) return { type: "api" };
	let code;
	try {
		code = fs.readFileSync(filePath, "utf8");
	} catch {
		return { type: "unknown" };
	}
	const program = parseRouteModule(code);
	if (program && hasNamedExportInProgram(program, "getServerSideProps")) return { type: "ssr" };
	if (program && hasNamedExportInProgram(program, "getStaticProps")) {
		const revalidate = extractGetStaticPropsRevalidateFromProgram(program, code);
		if (revalidate === null || revalidate === false || revalidate === Infinity) return { type: "static" };
		if (revalidate === 0) return { type: "ssr" };
		return {
			type: "isr",
			revalidate
		};
	}
	return { type: "static" };
}
/**
* Classifies an App Router route.
*
* @param pagePath   Absolute path to the page.tsx (null for API-only routes)
* @param routePath  Absolute path to the route.ts handler (null for page routes)
* @param isDynamic  Whether the URL pattern contains dynamic segments
*/
function classifyAppRoute(pagePath, routePath, isDynamic) {
	if (routePath !== null && pagePath === null) return { type: "api" };
	const filePath = pagePath ?? routePath;
	if (!filePath) return { type: "unknown" };
	let code;
	try {
		code = fs.readFileSync(filePath, "utf8");
	} catch {
		return { type: "unknown" };
	}
	const program = parseRouteModule(code);
	const dynamicValue = program ? extractExportConstStringFromProgram(program, "dynamic") : null;
	if (dynamicValue === "force-dynamic") return { type: "ssr" };
	if (dynamicValue === "force-static" || dynamicValue === "error") return { type: "static" };
	const revalidateValue = program ? extractExportConstNumberFromProgram(program, "revalidate") : null;
	if (revalidateValue !== null) {
		if (revalidateValue === Infinity) return { type: "static" };
		if (revalidateValue === 0) return { type: "ssr" };
		if (revalidateValue > 0) return {
			type: "isr",
			revalidate: revalidateValue
		};
	}
	if (isDynamic) return { type: "ssr" };
	return { type: "unknown" };
}
/**
* Builds a sorted list of RouteRow objects from the discovered routes.
* Routes are sorted alphabetically by path, matching filesystem order.
*
* When `prerenderResult` is provided, routes that were classified as `unknown`
* by static analysis but were successfully rendered speculatively are upgraded
* to `static` (confirmed by execution). The `prerendered` flag is set on those
* rows so the formatter can add a legend note.
*/
function buildReportRows(options) {
	const rows = [];
	const renderedRoutes = /* @__PURE__ */ new Set();
	if (options.prerenderResult) {
		for (const r of options.prerenderResult.routes) if (r.status === "rendered") renderedRoutes.add(r.route);
	}
	for (const route of options.pageRoutes ?? []) {
		const { type, revalidate } = classifyPagesRoute(route.filePath);
		rows.push({
			pattern: route.pattern,
			type,
			revalidate
		});
	}
	for (const route of options.apiRoutes ?? []) rows.push({
		pattern: route.pattern,
		type: "api"
	});
	for (const route of options.appRoutes ?? []) {
		const { type, revalidate } = classifyAppRoute(getAppRouteRenderEntryPath(route), route.routePath, route.isDynamic);
		if (type === "unknown" && renderedRoutes.has(route.pattern)) rows.push({
			pattern: route.pattern,
			type: "static",
			prerendered: true
		});
		else rows.push({
			pattern: route.pattern,
			type,
			revalidate
		});
	}
	rows.sort((a, b) => a.pattern.localeCompare(b.pattern));
	return rows;
}
const SYMBOLS = {
	static: "○",
	isr: "◐",
	ssr: "ƒ",
	unknown: "?",
	api: "λ"
};
const LABELS = {
	static: "Static",
	isr: "ISR",
	ssr: "Dynamic",
	unknown: "Unknown",
	api: "API"
};
/**
* Formats a list of RouteRows into a Next.js-style build report string.
*
* Example output:
*   Route (pages)
*   ┌ ○ /
*   ├ ◐ /blog/:slug  (60s)
*   ├ ƒ /dashboard
*   └ λ /api/posts
*
*   ○ Static  ◐ ISR  ƒ Dynamic  λ API
*/
function formatBuildReport(rows, routerLabel = "app") {
	if (rows.length === 0) return "";
	const lines = [];
	lines.push(`  Route (${routerLabel})`);
	const maxPatternLen = Math.max(...rows.map((r) => r.pattern.length));
	rows.forEach((row, i) => {
		const isLast = i === rows.length - 1;
		const corner = rows.length === 1 ? "─" : i === 0 ? "┌" : isLast ? "└" : "├";
		const sym = SYMBOLS[row.type];
		const suffix = row.type === "isr" && row.revalidate !== void 0 ? `  (${row.revalidate}s)` : "";
		const padding = " ".repeat(maxPatternLen - row.pattern.length);
		lines.push(`  ${corner} ${sym} ${row.pattern}${padding}${suffix}`);
	});
	lines.push("");
	const usedTypes = [...new Set(rows.map((r) => r.type))].sort((a, b) => LABELS[a].localeCompare(LABELS[b]));
	lines.push("  " + usedTypes.map((t) => `${SYMBOLS[t]} ${LABELS[t]}`).join("  "));
	if (usedTypes.includes("unknown")) {
		lines.push("");
		lines.push("  ? Some routes could not be classified. vinext currently uses static analysis");
		lines.push("    and cannot detect dynamic API usage (headers(), cookies(), etc.) at build time.");
		lines.push("    Automatic classification will be improved in a future release.");
	}
	if (rows.some((r) => r.prerendered)) {
		lines.push("");
		lines.push("  ○ Routes marked static were confirmed by speculative prerender (attempted render");
		lines.push("    succeeded without dynamic API usage).");
	}
	return lines.join("\n");
}
/**
* Scans the project at `root`, classifies all routes, and prints the
* Next.js-style build report to stdout.
*/
async function printBuildReport(options) {
	const { root } = options;
	const appDir = findDir(root, "app", "src/app");
	const pagesDir = findDir(root, "pages", "src/pages");
	if (!appDir && !pagesDir) return;
	if (appDir) {
		const { appRouter } = await import("../routing/app-router.js");
		const rows = buildReportRows({
			appRoutes: await appRouter(appDir, options.pageExtensions),
			prerenderResult: options.prerenderResult
		});
		if (rows.length > 0) console.log("\n" + formatBuildReport(rows, "app"));
	}
	if (pagesDir) {
		const { pagesRouter, apiRouter } = await import("../routing/pages-router.js");
		const [pageRoutes, apiRoutes] = await Promise.all([pagesRouter(pagesDir, options.pageExtensions), apiRouter(pagesDir, options.pageExtensions)]);
		const rows = buildReportRows({
			pageRoutes,
			apiRoutes,
			prerenderResult: options.prerenderResult
		});
		if (rows.length > 0) console.log("\n" + formatBuildReport(rows, "pages"));
	}
}
//#endregion
export { buildReportRows, classifyAppRoute, classifyLayoutSegmentConfig, classifyPagesRoute, extractExportConstNumber, extractExportConstString, extractGetStaticPropsRevalidate, extractMiddlewareMatcherConfig, extractMiddlewareMatcherConfigValue, formatBuildReport, getAppRouteRenderEntryPath, hasExportedName, hasNamedExport, printBuildReport };
