import React from "react";

//#region src/shims/script-nonce-context.d.ts
declare const ScriptNonceContext: React.Context<string | undefined> | null;
declare function ScriptNonceProvider(props: React.PropsWithChildren<{
  nonce?: string;
}>): React.ReactElement;
declare function withScriptNonce(element: React.ReactElement, nonce?: string): React.ReactElement;
declare function useScriptNonce(): string | undefined;
//#endregion
export { ScriptNonceContext, ScriptNonceProvider, useScriptNonce, withScriptNonce };