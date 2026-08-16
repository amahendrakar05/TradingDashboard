import path from "../deps/.pnpm/pathslash@0.1.0/deps/pathslash/dist/index.js";
import { createRequire } from "node:module";
import { parseAst } from "vite";
import { pathToFileURL } from "node:url";
//#region src/plugins/styled-jsx.ts
const STYLED_JSX_IMPORT_RE = /^styled-jsx(?:\/.*)?$/;
const NODE_MODULES_RE = /[\\/]node_modules[\\/]/;
const STYLED_JSX_SOURCE_RE = /(?:<style\b|from\s+["']styled-jsx\/css["']|require\s*\(\s*["']styled-jsx\/css["']\s*\))/;
const STYLED_JSX_CSS_RE = /(?:from\s+["']styled-jsx\/css["']|require\s*\(\s*["']styled-jsx\/css["']\s*\))/;
function hasStyledJsxTag(source, id) {
	const cleanId = id.split("?")[0];
	const extension = path.extname(cleanId);
	const lang = extension === ".ts" || extension === ".mts" || extension === ".cts" ? "ts" : "tsx";
	let ast;
	try {
		ast = parseAst(source, { lang });
	} catch {
		return false;
	}
	const pending = [ast];
	const visited = /* @__PURE__ */ new Set();
	while (pending.length > 0) {
		const value = pending.pop();
		if (!value || typeof value !== "object" || visited.has(value)) continue;
		visited.add(value);
		const node = value;
		if (node.type === "JSXOpeningElement") {
			const name = node.name;
			if (name?.type === "JSXIdentifier" && name.name === "style") {
				if (node.attributes?.some((attribute) => {
					if (attribute.type !== "JSXAttribute") return false;
					const attributeName = attribute.name;
					return attributeName?.type === "JSXIdentifier" && attributeName.name === "jsx";
				})) return true;
			}
		}
		for (const child of Object.values(node)) if (Array.isArray(child)) pending.push(...child);
		else if (child && typeof child === "object") pending.push(child);
	}
	return false;
}
function createProjectRequire(projectRoot) {
	return createRequire(path.join(projectRoot, "package.json"));
}
function resolveNextRequire(projectRoot) {
	try {
		return createRequire(createProjectRequire(projectRoot).resolve("next/package.json"));
	} catch {
		return null;
	}
}
function parserOptions(id) {
	const extension = path.extname(id.split("?")[0]);
	if (extension === ".ts" || extension === ".tsx") return {
		syntax: "typescript",
		tsx: extension === ".tsx",
		decorators: true
	};
	return {
		syntax: "ecmascript",
		jsx: true
	};
}
function createStyledJsxPlugin(initialProjectRoot, options = {}) {
	let projectRoot = initialProjectRoot;
	let development = false;
	let nextRequire;
	let compilerPromise = null;
	const importModule = options.importModule ?? ((url) => import(url));
	function getNextRequire() {
		nextRequire ??= resolveNextRequire(projectRoot);
		return nextRequire;
	}
	async function getCompiler() {
		if (!compilerPromise) {
			const requireFromNext = getNextRequire();
			if (!requireFromNext) throw new Error("[vinext] styled-jsx requires an installed next package so vinext can use its matching compiler.");
			const compilerPath = requireFromNext.resolve("next/dist/build/swc");
			compilerPromise = importModule(pathToFileURL(compilerPath).href).then(async (compiler) => {
				await compiler.loadBindings();
				return compiler;
			});
		}
		return compilerPromise;
	}
	return {
		name: "vinext:styled-jsx",
		enforce: "pre",
		configResolved(config) {
			development = config.command === "serve";
			if (config.root !== projectRoot) {
				projectRoot = config.root;
				nextRequire = void 0;
				compilerPromise = null;
			}
		},
		resolveId: {
			filter: { id: STYLED_JSX_IMPORT_RE },
			handler(source) {
				try {
					return getNextRequire()?.resolve(source) ?? null;
				} catch {}
				try {
					return createProjectRequire(projectRoot).resolve(source);
				} catch {
					return null;
				}
			}
		},
		transform: {
			filter: {
				id: {
					include: /\.[cm]?[jt]sx?(?:\?.*)?$/,
					exclude: NODE_MODULES_RE
				},
				code: STYLED_JSX_SOURCE_RE
			},
			async handler(source, id) {
				if (NODE_MODULES_RE.test(id.split("?")[0])) return null;
				const hasStyledJsxCss = STYLED_JSX_CSS_RE.test(source);
				const hasStyledJsxElement = !hasStyledJsxCss && hasStyledJsxTag(source, id);
				if (!hasStyledJsxCss && !hasStyledJsxElement) return null;
				if (!getNextRequire()) throw new Error("[vinext] styled-jsx requires an installed next package so vinext can use its matching compiler.");
				const result = await (await getCompiler()).transform(source, {
					filename: id.split("?")[0],
					sourceMaps: true,
					module: { type: "es6" },
					styledJsx: { useLightningcss: false },
					jsc: {
						parser: parserOptions(id),
						transform: {
							react: {
								runtime: "automatic",
								development,
								useBuiltins: true
							},
							optimizer: { simplify: false }
						}
					}
				});
				return {
					code: result.code,
					map: result.map ?? null
				};
			}
		}
	};
}
//#endregion
export { createStyledJsxPlugin };
