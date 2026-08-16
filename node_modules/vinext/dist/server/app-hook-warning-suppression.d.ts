import { AsyncLocalStorage } from "node:async_hooks";

//#region src/server/app-hook-warning-suppression.d.ts
declare const suppressHookWarningAls: AsyncLocalStorage<boolean>;
//#endregion
export { suppressHookWarningAls };