import { I18nContext } from "./i18n-context.js";

//#region src/shims/i18n-state.d.ts
type I18nState = {
  i18nContext: I18nContext | null;
};
/**
 * Run a function within an i18n state ALS scope.
 * Ensures per-request isolation for i18n context on concurrent runtimes.
 */
declare function runWithI18nState<T>(fn: () => Promise<T>): Promise<T>;
declare function runWithI18nState<T>(fn: () => T | Promise<T>): T | Promise<T>;
//#endregion
export { I18nState, runWithI18nState };