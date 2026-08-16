import * as React$1 from "react";

//#region src/shims/navigation-context-state.d.ts
/**
 * Map of parallel route key to child segments below the current layout.
 * The "children" key is always present.
 */
type SegmentMap = Readonly<Record<string, string[]>> & {
  readonly children: string[];
};
type NavigationContext = {
  pathname: string;
  searchParams: URLSearchParams;
  params: Record<string, string | string[]>;
};
declare const ServerInsertedHTMLContext: React$1.Context<((callback: () => React$1.ReactNode) => void) | null> | null;
declare function getLayoutSegmentContext(): React$1.Context<SegmentMap> | null;
declare function getBfcacheIdMapContext(): React$1.Context<Readonly<Record<string, string>> | null> | null;
declare function getBfcacheSegmentIdContext(): React$1.Context<string | null> | null;
type NavigationStateAccessors = {
  getServerContext: () => NavigationContext | null;
  setServerContext: (context: NavigationContext | null) => void;
  getInsertedHTMLCallbacks: () => Array<() => unknown>;
  clearInsertedHTMLCallbacks: () => void;
};
declare const GLOBAL_ACCESSORS_KEY: unique symbol;
declare function clearClientHydrationContext(): void;
/**
 * Register request-scoped accessors supplied by navigation-state.ts.
 * The global accessor key also bridges separate Vite module instances.
 */
declare function _registerStateAccessors(accessors: NavigationStateAccessors): void;
declare function getNavigationContext(): NavigationContext | null;
declare function setNavigationContext(context: NavigationContext | null): void;
declare function registerServerInsertedHTMLCallback(callback: () => unknown): void;
declare function flushServerInsertedHTML(): unknown[];
declare function renderServerInsertedHTML(): unknown[];
declare function clearServerInsertedHTML(): void;
//#endregion
export { GLOBAL_ACCESSORS_KEY, NavigationContext, NavigationStateAccessors, SegmentMap, ServerInsertedHTMLContext, _registerStateAccessors, clearClientHydrationContext, clearServerInsertedHTML, flushServerInsertedHTML, getBfcacheIdMapContext, getBfcacheSegmentIdContext, getLayoutSegmentContext, getNavigationContext, registerServerInsertedHTMLCallback, renderServerInsertedHTML, setNavigationContext };