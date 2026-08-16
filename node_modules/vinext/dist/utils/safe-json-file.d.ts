//#region src/utils/safe-json-file.d.ts
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
declare function readJsonFile<T>(filePath: string, options?: {
  onError?: (err: unknown) => void;
}): T | null;
//#endregion
export { readJsonFile };