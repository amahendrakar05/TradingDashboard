import * as React$1 from "react";

//#region src/shims/internal/app-router-context.d.ts
type NavigateOptions = {
  scroll?: boolean;
};
type PrefetchOptions = {
  kind?: unknown;
  onInvalidate?: () => void;
};
type AppRouterInstance = {
  bfcacheId: string;
  back(): void;
  forward(): void;
  refresh(): void;
  push(href: string, options?: NavigateOptions): void;
  replace(href: string, options?: NavigateOptions): void;
  prefetch(href: string, options?: PrefetchOptions): void;
  /**
   * Perform an experimental gesture transition navigation.
   * Only available when experimental.gestureTransition is enabled.
   */
  experimental_gesturePush?(href: string, options?: NavigateOptions): void;
};
declare const AppRouterContext: React$1.Context<AppRouterInstance | null> | null;
declare const GlobalLayoutRouterContext: React$1.Context<unknown> | null;
declare const LayoutRouterContext: React$1.Context<unknown> | null;
declare const MissingSlotContext: React$1.Context<Set<string>> | null;
declare const TemplateContext: React$1.Context<unknown> | null;
//#endregion
export { AppRouterContext, AppRouterInstance, GlobalLayoutRouterContext, LayoutRouterContext, MissingSlotContext, NavigateOptions, PrefetchOptions, TemplateContext };