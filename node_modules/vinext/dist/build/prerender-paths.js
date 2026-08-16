import path, { toSlash } from "../deps/.pnpm/pathslash@0.1.0/deps/pathslash/dist/index.js";
import { findDir } from "../utils/project.js";
import { apiRouter, pagesRouter } from "../routing/pages-router.js";
import { VINEXT_PRERENDER_SECRET_HEADER } from "../utils/protocol-headers.js";
import { classifyAppRoute, classifyPagesRoute, getAppRouteRenderEntryPath, hasNamedExport } from "./report.js";
import { appRouter } from "../routing/app-router.js";
import { normalizeStaticPathsEntry } from "../routing/route-pattern.js";
import { BLOCKED_PAGES, PHASE_PRODUCTION_BUILD } from "../shims/constants.js";
import { loadNextConfig, resolveNextConfig } from "../config/next-config.js";
import { readPrerenderSecret } from "./server-manifest.js";
import { startProdServer } from "../server/prod-server.js";
import { buildUrlFromParams, resolveParentParams } from "./prerender.js";
import fs from "node:fs";
//#region src/build/prerender-paths.ts
const PRERENDER_PATH_DISCOVERY_ENV = "__VINEXT_PRERENDER_PATH_DISCOVERY";
const PRERENDER_PATHS_MANIFEST = "vinext-prerender-paths.json";
const PATH_DISCOVERY_FETCH_TIMEOUT_MS = 3e4;
function readBuiltBuildId(serverDir) {
	try {
		const buildId = fs.readFileSync(path.join(serverDir, "BUILD_ID"), "utf-8").trim();
		return buildId.length > 0 ? buildId : null;
	} catch (error) {
		if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return null;
		throw error;
	}
}
function addPath(paths, seen, pathname) {
	if (seen.has(pathname)) return;
	seen.add(pathname);
	paths.push(pathname);
}
function warnDiscoveryFailure(route, error) {
	const message = error instanceof Error ? error.message : String(error);
	console.warn(`[vinext] Warning: failed to discover warmup path(s) for ${route}: ${message}`);
}
async function fetchDiscoveryEndpoint(url, headers) {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), PATH_DISCOVERY_FETCH_TIMEOUT_MS);
	try {
		const res = await fetch(url, {
			headers,
			signal: controller.signal
		});
		const text = await res.text();
		if (!res.ok || text === "null") return null;
		return text;
	} catch (error) {
		if (error instanceof Error && error.name === "AbortError") throw new Error(`path discovery timed out after ${PATH_DISCOVERY_FETCH_TIMEOUT_MS}ms`);
		throw error;
	} finally {
		clearTimeout(timeout);
	}
}
function fileHasNamedExport(filePath, name) {
	if (!filePath) return false;
	try {
		return hasNamedExport(fs.readFileSync(filePath, "utf-8"), name);
	} catch {
		return false;
	}
}
function resolveConfiguredRouteDirs(root, routeRootConfig) {
	if (!routeRootConfig) return {
		appDir: findDir(root, "app", "src/app"),
		pagesDir: findDir(root, "pages", "src/pages")
	};
	let baseDir;
	if (routeRootConfig.appDir) {
		baseDir = path.isAbsolute(routeRootConfig.appDir) ? routeRootConfig.appDir : path.resolve(root, routeRootConfig.appDir);
		baseDir = toSlash(baseDir);
	} else {
		const hasRootApp = fs.existsSync(path.join(root, "app"));
		const hasRootPages = fs.existsSync(path.join(root, "pages"));
		const hasSrcApp = fs.existsSync(path.join(root, "src", "app"));
		const hasSrcPages = fs.existsSync(path.join(root, "src", "pages"));
		baseDir = hasRootApp || hasRootPages ? root : hasSrcApp || hasSrcPages ? path.join(root, "src") : root;
	}
	const appDir = path.join(baseDir, "app");
	const pagesDir = path.join(baseDir, "pages");
	return {
		appDir: !routeRootConfig.disableAppRouter && fs.existsSync(appDir) ? appDir : null,
		pagesDir: fs.existsSync(pagesDir) ? pagesDir : null
	};
}
function appRouteMayHaveGenerateStaticParams(route) {
	if (fileHasNamedExport(route.pagePath, "generateStaticParams")) return true;
	return route.layouts.some((layoutPath) => fileHasNamedExport(layoutPath, "generateStaticParams"));
}
async function shouldStartPathDiscoveryServer(options) {
	if (options.appDir) {
		if ((await appRouter(options.appDir, options.pageExtensions)).some((route) => route.isDynamic && appRouteMayHaveGenerateStaticParams(route))) return true;
	}
	if (options.pagesDir) {
		if ((await pagesRouter(options.pagesDir, options.pageExtensions)).some((route) => route.isDynamic && fileHasNamedExport(route.filePath, "getStaticPaths"))) return true;
	}
	return false;
}
async function withPrerenderEndpoints(fn) {
	const previousPrerenderFlag = process.env.VINEXT_PRERENDER;
	const previousPathDiscoveryFlag = process.env[PRERENDER_PATH_DISCOVERY_ENV];
	process.env.VINEXT_PRERENDER = "1";
	process.env[PRERENDER_PATH_DISCOVERY_ENV] = "1";
	try {
		return await fn();
	} finally {
		if (previousPrerenderFlag === void 0) delete process.env.VINEXT_PRERENDER;
		else process.env.VINEXT_PRERENDER = previousPrerenderFlag;
		if (previousPathDiscoveryFlag === void 0) delete process.env[PRERENDER_PATH_DISCOVERY_ENV];
		else process.env[PRERENDER_PATH_DISCOVERY_ENV] = previousPathDiscoveryFlag;
	}
}
async function collectPagesPaths(options) {
	const [pageRoutes, apiRoutes] = await Promise.all([pagesRouter(options.pagesDir, options.pageExtensions), apiRouter(options.pagesDir, options.pageExtensions)]);
	const apiPatterns = new Set(apiRoutes.map((route) => route.pattern));
	const paths = [];
	const seen = /* @__PURE__ */ new Set();
	for (const route of pageRoutes) {
		if (apiPatterns.has(route.pattern)) continue;
		if (BLOCKED_PAGES.includes(route.pattern)) continue;
		if (route.pattern === "/404" || route.pattern === "/500" || route.pattern === "/_error") continue;
		const { type } = classifyPagesRoute(route.filePath);
		if (type === "api" || type === "ssr") continue;
		if (!route.isDynamic) {
			addPath(paths, seen, route.pattern);
			continue;
		}
		if (!fileHasNamedExport(route.filePath, "getStaticPaths")) continue;
		if (!options.baseUrl) continue;
		try {
			const search = new URLSearchParams({ pattern: route.pattern });
			const text = await fetchDiscoveryEndpoint(`${options.baseUrl}/__vinext/prerender/pages-static-paths?${search}`, options.secretHeaders);
			if (text === null) continue;
			const pathsResult = JSON.parse(text);
			for (const item of pathsResult.paths ?? []) {
				const normalized = normalizeStaticPathsEntry(item, route.pattern);
				if ("error" in normalized) throw new Error(normalized.error);
				addPath(paths, seen, buildUrlFromParams(route.pattern, normalized.params));
			}
		} catch (error) {
			warnDiscoveryFailure(route.pattern, error);
		}
	}
	return paths;
}
async function collectAppPaths(options) {
	const routes = await appRouter(options.appDir, options.pageExtensions);
	const paths = [];
	const seen = /* @__PURE__ */ new Set();
	const staticParamsCache = /* @__PURE__ */ new Map();
	const staticParamsMap = new Proxy({}, {
		get(_target, pattern) {
			return async ({ params }) => {
				if (!options.baseUrl) return null;
				const cacheKey = `${pattern}\0${JSON.stringify(params)}`;
				const cached = staticParamsCache.get(cacheKey);
				if (cached !== void 0) return cached;
				const request = (async () => {
					const search = new URLSearchParams({ pattern });
					if (Object.keys(params).length > 0) search.set("parentParams", JSON.stringify(params));
					const text = await fetchDiscoveryEndpoint(`${options.baseUrl}/__vinext/prerender/static-params?${search}`, options.secretHeaders);
					if (text === null) return null;
					return JSON.parse(text);
				})();
				request.catch(() => staticParamsCache.delete(cacheKey));
				staticParamsCache.set(cacheKey, request);
				return request;
			};
		},
		has() {
			return false;
		}
	});
	for (const route of routes) {
		const renderEntryPath = getAppRouteRenderEntryPath(route);
		if (!renderEntryPath) continue;
		const { type } = classifyAppRoute(renderEntryPath, route.routePath, route.isDynamic);
		if (type === "api") continue;
		if (type === "ssr" && !route.isDynamic) continue;
		if (!route.isDynamic) {
			addPath(paths, seen, route.pattern);
			continue;
		}
		if (!appRouteMayHaveGenerateStaticParams(route)) continue;
		try {
			const generateStaticParams = staticParamsMap[route.pattern];
			if (typeof generateStaticParams !== "function") continue;
			const parentParamSets = await resolveParentParams(route, staticParamsMap);
			let paramSets;
			if (parentParamSets.length > 0) {
				paramSets = [];
				for (const parentParams of parentParamSets) {
					const childResults = await generateStaticParams({ params: parentParams });
					if (childResults === null) {
						paramSets = null;
						break;
					}
					if (Array.isArray(childResults)) for (const childParams of childResults) paramSets.push({
						...parentParams,
						...childParams
					});
				}
			} else {
				const results = await generateStaticParams({ params: {} });
				paramSets = Array.isArray(results) || results === null ? results : [];
			}
			if (!paramSets?.length) continue;
			for (const params of paramSets) {
				if (params === null || params === void 0) continue;
				addPath(paths, seen, buildUrlFromParams(route.pattern, params));
			}
		} catch (error) {
			warnDiscoveryFailure(route.pattern, error);
		}
	}
	return paths;
}
async function startPathDiscoveryServer(options) {
	return startProdServer({
		port: 0,
		host: "127.0.0.1",
		outDir: options.pagesBundlePath ? path.dirname(path.dirname(options.pagesBundlePath)) : path.dirname(options.serverDir),
		rscEntryPath: options.rscBundlePath,
		serverEntryPath: options.pagesBundlePath,
		noCompression: true,
		purpose: "prerender"
	});
}
async function emitPrerenderPathManifest(options) {
	const { root } = options;
	const configuredRouteDirs = resolveConfiguredRouteDirs(root, options.routeRootConfig);
	const appDir = options.appDir !== void 0 ? options.appDir : configuredRouteDirs.appDir;
	const pagesDir = options.pagesDir !== void 0 ? options.pagesDir : configuredRouteDirs.pagesDir;
	if (!appDir && !pagesDir) return null;
	const defaultRscBundlePath = options.routeRootConfig?.rscOutDir ? path.join(path.resolve(root, options.routeRootConfig.rscOutDir), "index.js") : path.join(root, "dist", "server", "index.js");
	const rscBundlePath = options.rscBundlePath ?? defaultRscBundlePath;
	const pagesBundlePath = options.pagesBundlePath ?? path.join(root, "dist", "server", "entry.js");
	const bundleServerDir = fs.existsSync(rscBundlePath) ? path.dirname(rscBundlePath) : path.dirname(pagesBundlePath);
	const manifestDir = path.join(root, "dist", "server");
	const config = options.nextConfig ? { ...options.nextConfig } : { ...await resolveNextConfig(await loadNextConfig(root, PHASE_PRODUCTION_BUILD), root) };
	const builtBuildId = readBuiltBuildId(manifestDir) ?? readBuiltBuildId(bundleServerDir);
	if (builtBuildId) config.buildId = builtBuildId;
	const paths = [];
	const seen = /* @__PURE__ */ new Set();
	await withPrerenderEndpoints(async () => {
		let prodServer = null;
		if (await shouldStartPathDiscoveryServer({
			appDir,
			pagesDir,
			pageExtensions: config.pageExtensions
		})) try {
			prodServer = await startPathDiscoveryServer({
				serverDir: bundleServerDir,
				pagesBundlePath: !appDir && pagesDir ? pagesBundlePath : void 0,
				rscBundlePath: appDir ? rscBundlePath : void 0
			});
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			console.warn(`[vinext] Warning: failed to start prerender path discovery server: ${message}`);
		}
		const baseUrl = prodServer ? `http://127.0.0.1:${prodServer.port}` : null;
		const prerenderSecret = readPrerenderSecret(bundleServerDir) ?? readPrerenderSecret(manifestDir);
		const secretHeaders = prerenderSecret ? { [VINEXT_PRERENDER_SECRET_HEADER]: prerenderSecret } : {};
		try {
			if (appDir) for (const pathname of await collectAppPaths({
				appDir,
				baseUrl,
				pageExtensions: config.pageExtensions,
				secretHeaders
			})) addPath(paths, seen, pathname);
			if (pagesDir) for (const pathname of await collectPagesPaths({
				baseUrl,
				pagesDir,
				pageExtensions: config.pageExtensions,
				secretHeaders
			})) addPath(paths, seen, pathname);
		} finally {
			if (prodServer) await new Promise((resolve) => prodServer.server.close(() => resolve()));
		}
	});
	const manifest = {
		buildId: config.buildId,
		trailingSlash: config.trailingSlash,
		paths
	};
	fs.mkdirSync(manifestDir, { recursive: true });
	fs.writeFileSync(path.join(manifestDir, PRERENDER_PATHS_MANIFEST), JSON.stringify(manifest, null, 2) + "\n", "utf-8");
	console.log(`  Discovered ${paths.length} CDN warmup path(s).`);
	return manifest;
}
//#endregion
export { PRERENDER_PATHS_MANIFEST, PRERENDER_PATH_DISCOVERY_ENV, emitPrerenderPathManifest };
