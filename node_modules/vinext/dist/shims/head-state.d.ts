import React from "react";

//#region src/shims/head-state.d.ts
type HeadState = {
  ssrHeadChildren: React.ReactNode[];
  documentInitialHead: React.ReactNode[];
};
/**
 * Run a function within a head state ALS scope.
 * Ensures per-request isolation for Pages Router <Head> elements
 * on concurrent runtimes.
 */
declare function runWithHeadState<T>(fn: () => Promise<T>): Promise<T>;
declare function runWithHeadState<T>(fn: () => T | Promise<T>): T | Promise<T>;
//#endregion
export { HeadState, runWithHeadState };