import { PprFallbackShellState } from "../shims/ppr-fallback-shell.js";
import { ReactNode } from "react";

//#region src/server/app-ppr-fallback-shell-render.d.ts
type AppPageBoundaryOnError = (error: unknown, requestInfo: unknown, errorContext: unknown) => unknown;
type AppPageRenderableElement = ReactNode | Record<string, ReactNode>;
type WarmPprFallbackShellCachesOptions = {
  element: AppPageRenderableElement;
  onError: AppPageBoundaryOnError;
  renderToReadableStream: (element: AppPageRenderableElement, options: {
    onError: AppPageBoundaryOnError;
    signal?: AbortSignal;
  }) => ReadableStream<Uint8Array>;
  state: PprFallbackShellState;
};
declare function warmPprFallbackShellCaches(options: WarmPprFallbackShellCachesOptions): Promise<void>;
//#endregion
export { WarmPprFallbackShellCachesOptions, warmPprFallbackShellCaches };