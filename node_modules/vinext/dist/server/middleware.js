import path from "../deps/.pnpm/pathslash@0.1.0/deps/pathslash/dist/index.js";
import { matchPattern, matchesMiddleware } from "./middleware-matcher.js";
import { resolveMiddlewareModuleHandler, runGeneratedMiddleware } from "./middleware-runtime.js";
import fs from "node:fs";
//#region src/server/middleware.ts
/**
* Determine whether a middleware/proxy file path refers to a proxy file.
* proxy.ts files accept `proxy` or `default` exports.
* middleware.ts files accept `middleware` or `default` exports.
*
* Matches Next.js behavior where each file type only accepts its own
* named export or a default export:
* https://github.com/vercel/next.js/blob/canary/packages/next/src/build/templates/middleware.ts
*/
function isProxyFile(filePath) {
	const base = path.basename(filePath);
	return base === "proxy" || base.startsWith("proxy.");
}
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
function resolveMiddlewareHandler(mod, filePath) {
	return resolveMiddlewareModuleHandler(mod, {
		filePath,
		isProxy: isProxyFile(filePath)
	});
}
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
function findMiddlewareFile(root, fileMatcher, conventionDir = root) {
	let proxyPath = null;
	for (const ext of fileMatcher.dottedExtensions) {
		const fullPath = path.join(conventionDir, `proxy${ext}`);
		if (fs.existsSync(fullPath)) {
			proxyPath = fullPath;
			break;
		}
	}
	let middlewarePath = null;
	for (const ext of fileMatcher.dottedExtensions) {
		const fullPath = path.join(conventionDir, `middleware${ext}`);
		if (fs.existsSync(fullPath)) {
			middlewarePath = fullPath;
			break;
		}
	}
	if (proxyPath && middlewarePath) {
		const relativeProxyPath = `./${path.relative(root, proxyPath)}`;
		const relativeMiddlewarePath = `./${path.relative(root, middlewarePath)}`;
		throw new Error(`Both middleware file "${relativeMiddlewarePath}" and proxy file "${relativeProxyPath}" are detected. Please use "${relativeProxyPath}" only. Learn more: https://nextjs.org/docs/messages/middleware-to-proxy`);
	}
	if (proxyPath) return proxyPath;
	if (middlewarePath) {
		console.warn("The \"middleware\" file convention is deprecated. Please use \"proxy\" instead.\n\n  To migrate automatically, run:\n  npx @next/codemod@canary middleware-to-proxy .\n\n  Learn more: https://nextjs.org/docs/messages/middleware-to-proxy");
		return middlewarePath;
	}
	return null;
}
function isMiddlewareModule(value) {
	return !!value && typeof value === "object";
}
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
async function runMiddleware(runner, middlewarePath, request, i18nConfig, basePath, trailingSlash, isDataRequest, normalizedPathname) {
	const mod = await runner.import(middlewarePath);
	if (!isMiddlewareModule(mod)) throw new Error(`Middleware module "${middlewarePath}" did not evaluate to an object.`);
	return runGeneratedMiddleware({
		basePath,
		filePath: middlewarePath,
		hadBasePath: true,
		i18nConfig,
		includeErrorDetails: process.env.NODE_ENV !== "production",
		isDataRequest,
		isProxy: isProxyFile(middlewarePath),
		module: mod,
		normalizedPathname,
		request,
		trailingSlash
	});
}
//#endregion
export { findMiddlewareFile, isProxyFile, matchPattern, matchesMiddleware, resolveMiddlewareHandler, runMiddleware };
