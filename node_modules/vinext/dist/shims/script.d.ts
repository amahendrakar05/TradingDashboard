import React from "react";

//#region src/shims/script.d.ts
type ScriptProps = React.ScriptHTMLAttributes<HTMLScriptElement> & {
  /** Script source URL */src?: string; /** Loading strategy. Default: "afterInteractive" */
  strategy?: "beforeInteractive" | "afterInteractive" | "lazyOnload" | "worker"; /** Unique identifier for the script */
  id?: string; /** Called when the script has loaded */
  onLoad?: (e: unknown) => void; /** Called when the script is ready (after load, and on every re-render if already loaded) */
  onReady?: () => void; /** Called on script load error */
  onError?: (e: unknown) => void; /** Inline script content */
  children?: React.ReactNode; /** Script type attribute */
  type?: string; /** Async attribute */
  async?: boolean; /** Defer attribute */
  defer?: boolean; /** Crossorigin attribute */
  crossOrigin?: React.ScriptHTMLAttributes<HTMLScriptElement>["crossOrigin"]; /** Nonce for CSP */
  nonce?: string; /** Integrity hash */
  integrity?: string;
  /**
   * Associated stylesheets to load alongside the script. Emitted as
   * `<link rel="stylesheet" href="...">` on SSR (via `ReactDOM.preinit`)
   * and inserted into `<head>` on the client load path.
   *
   * Mirrors Next.js App Router behaviour at
   * `.nextjs-ref/packages/next/src/client/script.tsx` (`insertStylesheets`
   * and the `appDir` block).
   */
  stylesheets?: string[];
};
/**
 * Load a script imperatively (outside of React).
 */
declare function handleClientScriptLoad(props: ScriptProps): void;
/**
 * Initialize multiple scripts at once (called during app bootstrap).
 */
declare function initScriptLoader(scripts: ScriptProps[]): void;
declare function Script(props: ScriptProps): React.ReactElement | null;
//#endregion
export { ScriptProps, Script as default, handleClientScriptLoad, initScriptLoader };