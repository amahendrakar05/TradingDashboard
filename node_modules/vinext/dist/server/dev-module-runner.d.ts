import { DevEnvironment } from "vite";
import { ModuleRunner } from "vite/module-runner";

//#region src/server/dev-module-runner.d.ts
/**
 * A Vite DevEnvironment duck-typed to the minimal surface we need.
 * `DevEnvironment.fetchModule()` is a plain async method available on all
 * environment types — including Cloudflare's custom environments that don't
 * support the hot-channel-based transport.
 */
type DevEnvironmentLike = {
  fetchModule: (id: string, importer?: string, options?: {
    cached?: boolean;
    startOffset?: number;
  }) => Promise<Record<string, unknown>>;
};
/**
 * Build a ModuleRunner that calls `environment.fetchModule()` directly,
 * bypassing the hot channel entirely.
 *
 * Safe to construct and call at any time — including during `configureServer()`
 * before the server is listening, and inside request handlers — because it
 * never accesses `environment.hot.api`.
 *
 * @param environment - Any Vite DevEnvironment (or duck-typed equivalent).
 *   Typically `server.environments["ssr"]`.
 */
declare function createDirectRunner(environment: DevEnvironmentLike | DevEnvironment): ModuleRunner;
//#endregion
export { createDirectRunner };