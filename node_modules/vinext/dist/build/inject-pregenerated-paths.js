import path from "../deps/.pnpm/pathslash@0.1.0/deps/pathslash/dist/index.js";
import { escapeRegExp } from "../utils/regex.js";
import { readPrerenderManifest } from "../server/prerender-manifest.js";
import fs from "node:fs";
//#region src/build/inject-pregenerated-paths.ts
const VINEXT_PREGEN_START = "/* __VINEXT_PREGENERATED_CONCRETE_PATHS_START__ */";
const VINEXT_PREGEN_END = "/* __VINEXT_PREGENERATED_CONCRETE_PATHS_END__ */";
const VINEXT_PREGEN_RE = new RegExp(`${escapeRegExp(VINEXT_PREGEN_START)}[\\s\\S]*?${escapeRegExp(VINEXT_PREGEN_END)}\\n?`, "g");
function injectPregeneratedConcretePaths(root) {
	const workerEntry = path.resolve(root, "dist", "server", "index.js");
	if (!fs.existsSync(workerEntry)) return;
	let code = fs.readFileSync(workerEntry, "utf-8").replace(VINEXT_PREGEN_RE, "");
	const table = readPrerenderManifest(path.join(root, "dist", "server", "vinext-prerender.json"))?.pregeneratedConcretePaths ?? [];
	if (table.length > 0) {
		globalThis.__VINEXT_PREGENERATED_CONCRETE_PATHS = table;
		code = `${VINEXT_PREGEN_START}\nglobalThis.__VINEXT_PREGENERATED_CONCRETE_PATHS = ${JSON.stringify(table)};\n${VINEXT_PREGEN_END}\n` + code;
	} else delete globalThis.__VINEXT_PREGENERATED_CONCRETE_PATHS;
	fs.writeFileSync(workerEntry, code);
}
//#endregion
export { injectPregeneratedConcretePaths };
