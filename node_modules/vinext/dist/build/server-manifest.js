import path from "../deps/.pnpm/pathslash@0.1.0/deps/pathslash/dist/index.js";
import { readJsonFile } from "../utils/safe-json-file.js";
//#region src/build/server-manifest.ts
/**
* Shared utilities for reading/writing vinext-server.json.
*
* Kept in a separate file so both build-time code (prerender.ts) and
* runtime code (prod-server.ts) can import it without creating a circular
* dependency.
*/
/**
* Read the prerender secret from `vinext-server.json` in `serverDir`.
*
* Returns `undefined` if the file does not exist or cannot be parsed.
* Callers that require a secret (i.e. the prerender phase itself) should
* warn when this returns `undefined`.
*/
function readPrerenderSecret(serverDir) {
	return readJsonFile(path.join(serverDir, "vinext-server.json"))?.prerenderSecret;
}
//#endregion
export { readPrerenderSecret };
