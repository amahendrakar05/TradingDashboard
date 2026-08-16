import fs from "node:fs";
//#region src/utils/safe-json-file.ts
/**
* Read and parse a JSON file, returning `null` if the file is missing,
* unreadable, or contains invalid JSON.
*
* Pass `onError` to log/observe failures while still receiving `null`. The
* callback is invoked for any thrown error from `readFileSync` or
* `JSON.parse` (e.g. `ENOENT`, syntax errors).
*
* Callers that need a default value other than `null` should map the result:
*   `readJsonFile<string[]>(p) ?? []`
*/
function readJsonFile(filePath, options) {
	try {
		return JSON.parse(fs.readFileSync(filePath, "utf-8"));
	} catch (err) {
		options?.onError?.(err);
		return null;
	}
}
//#endregion
export { readJsonFile };
