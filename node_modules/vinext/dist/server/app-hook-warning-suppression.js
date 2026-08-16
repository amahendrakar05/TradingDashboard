import { AsyncLocalStorage } from "node:async_hooks";
//#region src/server/app-hook-warning-suppression.ts
const suppressHookWarningAls = new AsyncLocalStorage();
const _origConsoleError = console.error;
console.error = (...args) => {
	if (suppressHookWarningAls.getStore() === true && typeof args[0] === "string" && args[0].includes("Invalid hook call")) return;
	_origConsoleError.apply(console, args);
};
//#endregion
export { suppressHookWarningAls };
