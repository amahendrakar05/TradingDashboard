//#region src/client/validate-module-path.d.ts
/**
 * Defense-in-depth: validate module paths before passing them to dynamic import().
 *
 * Shared between entry.ts (initial hydration) and router.ts (client-side navigation)
 * to ensure all dynamic imports of page/app modules go through the same validation.
 *
 * Blocks:
 * - Non-string or empty values
 * - Paths that don't start with `/` or `./` (e.g., `https://evil.com/...`)
 * - Protocol URLs (`://`)
 * - Protocol-relative URLs (`//...`)
 * - Directory traversal (`..`)
 */
declare function isValidModulePath(p: unknown): p is string;
//#endregion
export { isValidModulePath };