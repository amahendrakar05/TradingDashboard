import { NextI18nConfig } from "../config/next-config.js";
import { ValidFileMatcher } from "../routing/file-matcher.js";
import { NextFetchEvent, NextRequest } from "../shims/server.js";
import { MiddlewareModule, MiddlewareResult } from "./middleware-runtime.js";
import { matchPattern, matchesMiddleware } from "./middleware-matcher.js";
import { ModuleRunner } from "vite/module-runner";

//#region src/server/middleware.d.ts
/**
 * Determine whether a middleware/proxy file path refers to a proxy file.
 * proxy.ts files accept `proxy` or `default` exports.
 * middleware.ts files accept `middleware` or `default` exports.
 *
 * Matches Next.js behavior where each file type only accepts its own
 * named export or a default export:
 * https://github.com/vercel/next.js/blob/canary/packages/next/src/build/templates/middleware.ts
 */
declare function isProxyFile(filePath: string): boolean;
/**
 * Resolve the middleware/proxy handler function from a module's exports.
 * Matches Next.js behavior: for proxy files, check `proxy` then `default`;
 * for middleware files, check `middleware` then `default`.
 *
 * Throws if the file exists but doesn't export a valid function, matching
 * Next.js's ProxyMissingExportError behavior.
 *
 * @see https://github.com/vercel/next.js/blob/canary/packages/next/src/build/templates/middleware.ts
 * @see https://github.com/vercel/next.js/blob/canary/test/e2e/app-dir/proxy-missing-export/proxy-missing-export.test.ts
 */
declare function resolveMiddlewareHandler(mod: MiddlewareModule, filePath: string): (request: NextRequest, event: NextFetchEvent) => Response | undefined | void | Promise<Response | undefined | void>;
/**
 * Find the proxy or middleware file at the selected app/pages convention level.
 * Checks for proxy.ts (Next.js 16) first, then falls back to middleware.ts.
 * If middleware.ts is found, logs a deprecation warning.
 *
 * Note on log noise: this function is called from Vite's `config` hook, which
 * fires once per build environment (RSC, SSR, client, …). That means a project
 * still using `middleware.ts` will see this warning emitted 2–3 times per
 * build. The warning is benign — it does not abort the build. Next.js itself
 * emits the same message via `Log.warnOnce`; matching that parity would
 * require either a per-root deduplication map or hoisting the warning out of
 * this function (e.g. into the plugin's `configResolved` hook). Tracked as a
 * follow-up; see the deploy-suite investigation in run 25870737355.
 *
 * @see https://github.com/vercel/next.js/blob/canary/packages/next/src/build/index.ts
 *   (search for "MIDDLEWARE_FILENAME" + "file convention is deprecated")
 */
declare function findMiddlewareFile(root: string, fileMatcher: ValidFileMatcher, conventionDir?: string): string | null;
/**
 * Load and execute middleware for a given request.
 *
 * @param runner - A ModuleRunner used to load the middleware module.
 *   Must be a long-lived instance created once (e.g. in configureServer) via
 *   createDirectRunner() — NOT recreated per request. Using server.ssrLoadModule
 *   directly crashes with `outsideEmitter` when @cloudflare/vite-plugin is
 *   present because SSRCompatModuleRunner reads environment.hot.api synchronously.
 * @param middlewarePath - Absolute path to the middleware file
 * @param request - The incoming Request object
 * @returns Middleware result describing what action to take
 */
declare function runMiddleware(runner: ModuleRunner, middlewarePath: string, request: Request, i18nConfig?: NextI18nConfig | null, basePath?: string, trailingSlash?: boolean, isDataRequest?: boolean, normalizedPathname?: string): Promise<MiddlewareResult>;
//#endregion
export { findMiddlewareFile, isProxyFile, matchPattern, matchesMiddleware, resolveMiddlewareHandler, runMiddleware };