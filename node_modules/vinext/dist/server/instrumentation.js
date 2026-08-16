import path from "../deps/.pnpm/pathslash@0.1.0/deps/pathslash/dist/index.js";
import { getRequestExecutionContext } from "../shims/request-context.js";
import fs from "node:fs";
//#region src/server/instrumentation.ts
/**
* instrumentation.ts support
*
* Next.js supports an `instrumentation.ts` file at the project root that
* exports a `register()` function. This function is called once when the
* server starts, before any request handling. It's the recommended way to
* set up observability tools (Sentry, Datadog, OpenTelemetry, etc.).
*
* Optionally, it can also export `onRequestError()` which is called when
* an unhandled error occurs during request handling.
*
* References:
* - https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
*
* ## App Router
*
* For App Router, `register()` is baked directly into the generated RSC entry
* as a top-level `await` at module evaluation time (see `entries/app-rsc-entry.ts`
* `generateRscEntry`). This means it runs inside the Worker process (or RSC
* Vite environment) — the same process that handles requests — before any
* request is served. `runInstrumentation()` is NOT called from `configureServer`
* for App Router.
*
* The `onRequestError` handler is stored on `globalThis` so it is visible across
* the RSC and SSR Vite environments (separate module graphs, same Node.js process).
* With `@cloudflare/vite-plugin` it runs entirely inside the Worker, so
* `globalThis` is the Worker's global — also correct.
*
* ## Pages Router
*
* Pages Router has no RSC entry, so `configureServer()` is the right place to
* call `register()`. `runInstrumentation()` accepts a `ModuleRunner` (created
* via `createDirectRunner()`) rather than `server.ssrLoadModule()` so it is
* safe when `@cloudflare/vite-plugin` is present — that plugin replaces the
* SSR environment's hot channel, causing `ssrLoadModule()` to crash with
* `TypeError: Cannot read properties of undefined (reading 'outsideEmitter')`.
*/
/**
* Import a module via the runner and cast the result to `Record<string, any>`.
*
* Centralises the `as Record<string, any>` cast so callers don't need
* per-call oxlint-disable comments.
*/
async function importModule(runner, id) {
	return await runner.import(id);
}
const INSTRUMENTATION_LOCATIONS = ["", "src/"];
function findInstrumentationHookFile(root, basename, fileMatcher) {
	for (const dir of INSTRUMENTATION_LOCATIONS) for (const ext of fileMatcher.dottedExtensions) {
		const fullPath = path.join(root, dir, `${basename}${ext}`);
		if (fs.existsSync(fullPath)) return fullPath;
	}
	return null;
}
/**
* Find the instrumentation file in the project root.
*/
function findInstrumentationFile(root, fileMatcher) {
	return findInstrumentationHookFile(root, "instrumentation", fileMatcher);
}
/**
* Find the instrumentation-client file in the project root.
*/
function findInstrumentationClientFile(root, fileMatcher) {
	return findInstrumentationHookFile(root, "instrumentation-client", fileMatcher);
}
/**
* Get the registered onRequestError handler (if any).
*
* Reads from globalThis so it works across Vite environment boundaries.
*/
function getOnRequestErrorHandler() {
	return globalThis.__VINEXT_onRequestErrorHandler__ ?? null;
}
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
async function runInstrumentation(runner, instrumentationPath) {
	try {
		const mod = await runner.import(instrumentationPath);
		if (typeof mod.register === "function") await mod.register();
		if (typeof mod.onRequestError === "function") globalThis.__VINEXT_onRequestErrorHandler__ = mod.onRequestError;
	} catch (err) {
		console.error("[vinext] Failed to load instrumentation:", err instanceof Error ? err.message : String(err));
	}
}
/**
* Report a request error via the instrumentation handler.
*
* No-op if no onRequestError handler is registered.
*
* Reads the handler from globalThis so this function works correctly regardless
* of which environment it is called from.
*/
function reportRequestError(error, request, context) {
	const handler = getOnRequestErrorHandler();
	if (!handler) return Promise.resolve();
	const promise = (async () => {
		try {
			await handler(error, request, context);
		} catch (reportErr) {
			console.error("[vinext] onRequestError handler threw:", reportErr instanceof Error ? reportErr.message : String(reportErr));
		}
	})();
	getRequestExecutionContext()?.waitUntil(promise);
	return promise;
}
//#endregion
export { findInstrumentationClientFile, findInstrumentationFile, getOnRequestErrorHandler, importModule, reportRequestError, runInstrumentation };
