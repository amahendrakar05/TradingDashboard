import { AstRecord } from "./ast-utils.js";

//#region src/plugins/ast-scope.d.ts
type AstScope = {
  parent: AstScope | null;
  bindings: Set<string>;
};
declare function createAstScope<T extends AstScope>(parent: T | null): AstScope;
declare function hasAstBinding(scope: AstScope, name: string): boolean;
declare function isFunctionNode(node: AstRecord): boolean;
declare function collectDirectScopeBindings(node: AstRecord, scope: AstScope, onVariableDeclarator?: (declaration: AstRecord, declarator: AstRecord) => void): void;
declare function collectLoopScopeBindings(node: AstRecord, scope: AstScope, onVariableDeclarator?: (declaration: AstRecord, declarator: AstRecord) => void): void;
declare function collectSwitchScopeBindings(node: AstRecord, scope: AstScope, onVariableDeclarator?: (declaration: AstRecord, declarator: AstRecord) => void): void;
declare function collectVarScopeBindings(node: AstRecord, scope: AstScope, root?: boolean): void;
//#endregion
export { AstScope, collectDirectScopeBindings, collectLoopScopeBindings, collectSwitchScopeBindings, collectVarScopeBindings, createAstScope, hasAstBinding, isFunctionNode };