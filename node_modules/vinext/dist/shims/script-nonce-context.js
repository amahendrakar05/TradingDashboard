import React from "react";
//#region src/shims/script-nonce-context.tsx
const ScriptNonceContext = typeof React.createContext === "function" ? React.createContext(void 0) : null;
function ScriptNonceProvider(props) {
	if (!ScriptNonceContext) return React.createElement(React.Fragment, null, props.children);
	return React.createElement(ScriptNonceContext.Provider, { value: props.nonce }, props.children);
}
function withScriptNonce(element, nonce) {
	if (!nonce || !ScriptNonceContext) return element;
	return React.createElement(ScriptNonceProvider, { nonce }, element);
}
function createScriptNonceHook(context) {
	if (!context || typeof React.useContext !== "function") return function useScriptNonceFromContext() {};
	return function useScriptNonceFromContext() {
		return React.useContext(context);
	};
}
const useScriptNonceFromContext = createScriptNonceHook(ScriptNonceContext);
function useScriptNonce() {
	return useScriptNonceFromContext();
}
//#endregion
export { ScriptNonceContext, ScriptNonceProvider, useScriptNonce, withScriptNonce };
