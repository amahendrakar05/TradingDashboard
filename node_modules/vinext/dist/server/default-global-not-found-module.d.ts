import React from "react";

//#region src/server/default-global-not-found-module.d.ts
declare function DefaultGlobalNotFound(): React.ReactElement;
/**
 * Module-shaped wrapper around Next.js's built-in global not-found document.
 * Unlike the regular default not-found boundary, this component owns the
 * document shell because global not-found responses skip the root layout.
 */
declare const DEFAULT_GLOBAL_NOT_FOUND_MODULE: {
  readonly default: typeof DefaultGlobalNotFound;
};
//#endregion
export { DEFAULT_GLOBAL_NOT_FOUND_MODULE };