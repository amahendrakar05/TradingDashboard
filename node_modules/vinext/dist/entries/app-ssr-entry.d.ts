//#region src/entries/app-ssr-entry.d.ts
/**
 * Generate the virtual SSR entry module.
 *
 * This runs in the `ssr` Vite environment. It receives an RSC stream,
 * deserializes it to a React tree, and renders to HTML.
 *
 * When `hasPagesDir` is true (hybrid App + Pages Router project), the SSR
 * entry also re-exports selected Pages server entry hooks from
 * `virtual:vinext-server-entry` so the RSC bundle can access Pages Router
 * route metadata and fallback dispatchers via `import("./ssr/index.js")`.
 */
declare function generateSsrEntry(hasPagesDir?: boolean): string;
//#endregion
export { generateSsrEntry };