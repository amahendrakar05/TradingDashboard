export declare const dynamicImportRE: RegExp;
export declare const normallyImporteeRE: RegExp;
export declare const viteIgnoreRE: RegExp;
export declare const bareImportRE: RegExp;
export declare const deepImportRE: RegExp;
/**
 * @param {string} code - The code to check for dynamic imports.
 * @returns bool
 * @description Determines whether a string containing javascript code may contain dynamic imports. It should be noted this is a naive check
 * and may produce false positives, especially when import statements may appear in comments or strings. However, removing comments in their
 * entirety would require parsing the full AST to do so correctly.
 */
export declare function hasDynamicImport(code: string): boolean;
/**
 * Unlimit depth match
 * @todo Use RegExp refactor
 */
export declare function toLooseGlob(glob: string): string | string[];
/**
 * e.g. `src/foo/index.js` and has alias(@)
 *
 * ```
 * const maps = {
 *   './foo/index.js': [
 *     '@/foo',
 *     '@/foo/index',
 *     '@/foo/index.js',
 *   ],
 * }
 * ```
 */
export declare function mappingPath(paths: string[], alias?: Record<string, string>): Record<string, string[]>;
