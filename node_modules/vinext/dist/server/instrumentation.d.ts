import { ValidFileMatcher } from "../routing/file-matcher.js";

//#region src/server/instrumentation.d.ts
/**
 * Minimal duck-typed interface for the module runner passed to
 * `runInstrumentation`. Only `.import()` is used — this avoids requiring
 * callers (including tests) to provide a full `ModuleRunner` instance.
 */
type ModuleImporter = {
  import(id: string): Promise<unknown>;
};
/**
 * Import a module via the runner and cast the result to `Record<string, any>`.
 *
 * Centralises the `as Record<string, any>` cast so callers don't need
 * per-call oxlint-disable comments.
 */
declare function importModule(runner: ModuleImporter, id: string): Promise<Record<string, any>>;
/**
 * Find the instrumentation file in the project root.
 */
declare function findInstrumentationFile(root: string, fileMatcher: ValidFileMatcher): string | null;
/**
 * Find the instrumentation-client file in the project root.
 */
declare function findInstrumentationClientFile(root: string, fileMatcher: ValidFileMatcher): string | null;
/**
 * The onRequestError handler type from Next.js instrumentation.
 *
 * Called when an unhandled error occurs during request handling.
 * Provides the error, the request info, and an error context.
 */
type OnRequestErrorContext = {
  /** The route path (e.g., '/blog/[slug]') */routerKind: "Pages Router" | "App Router"; /** The matched route pattern */
  routePath: string; /** The route type */
  routeType: "render" | "route" | "action" | "middleware"; /** HTTP status code that will be sent */
  revalidateReason?: "on-demand" | "stale" | undefined;
};
type OnRequestErrorHandler = (error: Error, request: {
  path: string;
  method: string;
  headers: Record<string, string>;
}, context: OnRequestErrorContext) => void | Promise<void>;
/**
 * Get the registered onRequestError handler (if any).
 *
 * Reads from globalThis so it works across Vite environment boundaries.
 */
declare function getOnRequestErrorHandler(): OnRequestErrorHandler | null;
/**
 * Load and execute the instrumentation file via a ModuleRunner.
 *
 * Called once during Pages Router server startup (`configureServer`). It:
 * 1. Loads the instrumentation module via `runner.import()`.
 * 2. Calls the `register()` function if exported.
 * 3. Stores the `onRequestError()` handler on `globalThis` so it is visible
 *    to all Vite environment module graphs (SSR and the host process share
 *    the same Node.js `globalThis`).
 *
 * **App Router** does not use this function. For App Router, `register()` is
 * emitted as a top-level `await` inside the generated RSC entry module so it
 * runs in the same Worker/environment as request handling.
 *
 * @param runner - A ModuleRunner created via `createDirectRunner()`. Must be
 *   the same long-lived runner used for middleware and SSR so the module graph
 *   is shared. Safe with all Vite plugin combinations, including
 *   `@cloudflare/vite-plugin`, because it never touches the hot channel.
 * @param instrumentationPath - Absolute path to the instrumentation file
 */
declare function runInstrumentation(runner: ModuleImporter, instrumentationPath: string): Promise<void>;
/**
 * Report a request error via the instrumentation handler.
 *
 * No-op if no onRequestError handler is registered.
 *
 * Reads the handler from globalThis so this function works correctly regardless
 * of which environment it is called from.
 */
declare function reportRequestError(error: Error, request: {
  path: string;
  method: string;
  headers: Record<string, string>;
}, context: OnRequestErrorContext): Promise<void>;
//#endregion
export { ModuleImporter, OnRequestErrorContext, OnRequestErrorHandler, findInstrumentationClientFile, findInstrumentationFile, getOnRequestErrorHandler, importModule, reportRequestError, runInstrumentation };