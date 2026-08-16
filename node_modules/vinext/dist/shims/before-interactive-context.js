import React from "react";
//#region src/shims/before-interactive-context.tsx
const BeforeInteractiveContext = React.createContext(null);
function useBeforeInteractiveRegister() {
	return React.useContext(BeforeInteractiveContext);
}
//#endregion
export { BeforeInteractiveContext, useBeforeInteractiveRegister };
