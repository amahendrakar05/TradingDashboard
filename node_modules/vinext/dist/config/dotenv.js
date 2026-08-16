import path from "../deps/.pnpm/pathslash@0.1.0/deps/pathslash/dist/index.js";
import fs from "node:fs";
import { parseEnv } from "node:util";
//#region src/config/dotenv.ts
/**
* Next.js-compatible dotenv lookup order (highest priority first).
*/
function getDotenvFiles(mode) {
	return [
		`.env.${mode}.local`,
		...mode === "test" ? [] : [".env.local"],
		`.env.${mode}`,
		".env"
	];
}
/**
* Load .env files into processEnv with Next.js-like precedence:
* process.env > .env.<mode>.local > .env.local > .env.<mode> > .env.
*
* This mutates processEnv (defaults to process.env).
*
* ## Interaction with Vite's own .env loading
*
* Vite also loads .env files internally during createServer()/build(). That's
* fine — the two systems serve different purposes and don't conflict:
*
* - **vinext** populates `process.env` so that server-side code (SSR, API
*   routes, Server Components) can read env vars at runtime, and so the Vite
*   plugin's `config()` hook can scan `process.env` for `NEXT_PUBLIC_*` vars
*   to inline via `define`.
*
* - **Vite** loads .env files to populate `import.meta.env.VITE_*` for its
*   own client exposure mechanism (which Next.js apps don't use).
*
* Because we load first and neither system overwrites existing keys, Vite's
* pass is effectively a no-op for overlapping keys. For `start` and `deploy`
* commands (which don't go through Vite at all), this is the only loading.
*/
function loadDotenv({ root, mode, processEnv = process.env }) {
	const loadedFiles = [];
	const loadedEnv = {};
	for (const relativeFile of getDotenvFiles(mode)) {
		const filePath = path.join(root, relativeFile);
		if (!fs.existsSync(filePath)) continue;
		const expanded = expandEnv(parseEnv(fs.readFileSync(filePath, "utf-8")), processEnv);
		for (const [key, value] of Object.entries(expanded)) {
			if (processEnv[key] !== void 0) continue;
			processEnv[key] = value;
			loadedEnv[key] = value;
		}
		loadedFiles.push(relativeFile);
	}
	return {
		mode,
		loadedFiles,
		loadedEnv
	};
}
const ENV_REF_RE = /(\\)?\$(?:\{([A-Za-z_][A-Za-z0-9_]*)\}|([A-Za-z_][A-Za-z0-9_]*))/g;
function expandEnv(parsed, processEnv) {
	const expanded = {};
	const resolving = /* @__PURE__ */ new Set();
	const context = {
		...parsed,
		...processEnv
	};
	function resolveValue(key) {
		const cached = expanded[key];
		if (cached !== void 0) return cached;
		if (resolving.has(key)) return context[key] ?? "";
		const raw = context[key];
		if (raw === void 0) return "";
		resolving.add(key);
		let value = raw.replace(ENV_REF_RE, (match, escaped, braced, bare) => {
			if (escaped) return match.slice(1);
			return resolveValue(braced || bare);
		});
		value = value.replace(/\\\$/g, "$");
		resolving.delete(key);
		expanded[key] = value;
		context[key] = value;
		return value;
	}
	for (const key of Object.keys(parsed)) resolveValue(key);
	return expanded;
}
//#endregion
export { getDotenvFiles, loadDotenv };
