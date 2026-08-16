import { NavigationContext } from "../shims/navigation-context-state.js";
import { RootParams } from "../shims/root-params.js";
import { InitialNavigationCacheMetadata } from "./app-ssr-stream.js";
import { AppSsrRenderResult } from "./app-page-stream.js";
import { ReactFormState } from "react-dom/client";

//#region src/server/app-ssr-entry.d.ts
type FontPreload = {
  href: string;
  type: string;
};
type FontData = {
  links?: string[];
  styles?: string[];
  preloads?: FontPreload[];
};
declare function handleSsr(rscStream: ReadableStream<Uint8Array>, navContext: NavigationContext | null, fontData?: FontData, options?: {
  scriptNonce?: string;
  /** Pre-split side stream for embed+capture fusion. When provided,
   *  rscStream is fed directly to createFromReadableStream (no internal tee).
   *  The embed transform accumulates raw bytes. */
  sideStream?: ReadableStream<Uint8Array>; /** Out-parameter: filled with accumulated raw RSC bytes when sideStream is consumed. */
  capturedRscDataRef?: {
    value: Promise<ArrayBuffer> | null;
  };
  pprFallbackShellSignal?: AbortSignal;
  formState?: ReactFormState | null;
  basePath?: string;
  /**
   * Allow-list of OpenTelemetry propagation keys (from
   * `experimental.clientTraceMetadata`) to render as `<meta>` tags in the
   * SSR head. Undefined or empty disables emission entirely.
   */
  clientTraceMetadata?: readonly string[];
  /**
   * Maximum total length (in characters) of the preload `Link` header React
   * emits during SSR. `0` disables emission. From `reactMaxHeadersLength` in
   * `next.config`. Undefined falls back to React's own default.
   */
  reactMaxHeadersLength?: number;
  rootParams?: RootParams; /** Dev-only: original server error to surface in the browser overlay. */
  initialDevServerError?: unknown;
  /** When true, wait for the full React tree (including Suspense boundaries)
   *  to resolve before returning the HTML stream. Used for static prerender
   *  and ISR cache writes to avoid caching fallback content. */
  waitForAllReady?: boolean;
  fallbackToErrorDocumentOnShellError?: boolean;
  dynamicStaleTimeSeconds?: number;
  getInitialNavigationCacheMetadata?: () => InitialNavigationCacheMetadata;
}): Promise<AppSsrRenderResult>;
declare const _default: {
  fetch(request: Request): Promise<Response>;
};
//#endregion
export { FontData, FontPreload, _default as default, handleSsr };