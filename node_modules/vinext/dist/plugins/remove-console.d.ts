import MagicString from "magic-string";

//#region src/plugins/remove-console.d.ts
type RemoveConsoleConfig = boolean | {
  exclude: string[];
};
type RemoveConsoleResult = {
  code: string;
  map: ReturnType<MagicString["generateMap"]>;
};
/**
 * Walk the AST body looking for expression statements whose expression is a
 * CallExpression with a callee of `console.<identifier>`. When found, check
 * that the name is not in the excluded set and that `console` is not shadowed
 * at this scope. If all conditions pass, replace the entire statement with `;`.
 *
 * Returns `null` if no console calls are removed.
 */
declare function removeConsoleCalls(code: string, config: RemoveConsoleConfig): RemoveConsoleResult | null;
//#endregion
export { removeConsoleCalls };