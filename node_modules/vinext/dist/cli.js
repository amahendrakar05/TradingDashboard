#!/usr/bin/env node
import path, { toSlash } from "./deps/.pnpm/pathslash@0.1.0/deps/pathslash/dist/index.js";
import { detectPackageManager, ensureViteConfigCompatibility, hasAppDir, hasViteConfig } from "./utils/project.js";
import { formatReport, runCheck } from "./check.js";
import { parseArgs } from "./cli-args.js";
import { createDevServerConfigPlugin, normalizeDevServerHostname } from "./cli-dev-config.js";
import { PHASE_PRODUCTION_BUILD } from "./shims/constants.js";
import { createRscCompatibilityId, findVinextNextConfigInPlugins, loadNextConfig, resolveNextConfig, resolveNextConfigInput } from "./config/next-config.js";
import { generateRouteTypes } from "./typegen.js";
import { clearPagesClientAssetsBuildMetadata } from "./build/pages-client-assets-module.js";
import { runWithPreviewBuildCredentials } from "./build/preview-credentials.js";
import { findVinextPrerenderConfigInPlugins, findVinextRouteRootConfigInPlugins, formatVinextPrerenderLabel, resolveVinextPrerenderDecision } from "./config/prerender.js";
import vinext from "./index.js";
import { runPrerender } from "./build/run-prerender.js";
import { emitPrerenderPathManifest } from "./build/prerender-paths.js";
import { getReactUpgradeDeps } from "./utils/react-version.js";
import { init } from "./init.js";
import { resolveInitOptions } from "./init-platform.js";
import { loadDotenv } from "./config/dotenv.js";
import { resolveVinextPackageRoot } from "./utils/vinext-root.js";
import { emitStandaloneOutput } from "./build/standalone.js";
import { cleanBuildOutput } from "./build/clean-output.js";
import { formatAlreadyRunningError, tryAcquireLockfile } from "./server/dev-lockfile.js";
import { createRequire } from "node:module";
import fs from "node:fs";
import { pathToFileURL } from "node:url";
import { randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
//#region src/cli.ts
/**
* vinext CLI — drop-in replacement for the `next` command
*
*   vinext dev     Start development server (Vite)
*   vinext build   Build for production
*   vinext start   Start production server
*   vinext typegen Generate App Router route helper types
*   vinext lint    Run linter (delegates to eslint/oxlint)
*
* Automatically configures Vite with the vinext plugin — no vite.config.ts
* needed for most Next.js apps.
*/
let _viteModule = null;
/**
* Dynamically load Vite from the project root. Falls back to the bundled
* copy if the project doesn't have its own Vite installation.
*/
async function loadVite() {
	if (_viteModule) return _viteModule;
	const projectRoot = process.cwd();
	let vitePath;
	try {
		vitePath = createRequire(path.join(projectRoot, "package.json")).resolve("vite");
	} catch {
		vitePath = "vite";
	}
	const vite = await (vitePath === "vite" ? import(vitePath) : import(pathToFileURL(vitePath).href));
	_viteModule = vite;
	return vite;
}
/**
* Get the Vite version string. Returns "unknown" before loadVite() is called.
*/
function getViteVersion() {
	return _viteModule?.version ?? "unknown";
}
const VERSION = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf-8")).version;
const command = process.argv[2];
const rawArgs = process.argv.slice(3);
/**
* Create a custom Vite logger for build output.
*
* By default Vite/Rollup emit a lot of build noise: version banners, progress
* lines, chunk size tables, minChunkSize diagnostics, and various internal
* warnings that are either not actionable or already handled by vinext at
* runtime. This logger suppresses all of that while keeping the things that
* actually matter:
*
*   KEPT
*   ✓ N modules transformed.     — confirms the transform phase completed
*   ✓ built in Xs                — build timing (useful perf signal)
*   Genuine warnings/errors      — anything the user may need to act on
*
*   SUPPRESSED (info)
*   vite vX.Y.Z building...      — Vite version banner
*   transforming... / rendering chunks... / computing gzip size...
*   Initially, there are N chunks...  — Rollup minChunkSize diagnostics
*   After merging chunks, there are...
*   X are below minChunkSize.
*   Blank lines
*   Chunk/asset size table rows  — e.g. "  dist/client/assets/foo.js  42 kB"
*   [rsc] / [ssr] / [client] / [worker] — RSC plugin env section headers
*
*   SUPPRESSED (warn)
*   "dynamic import will not move module into another chunk"  — internal chunking note
*   "X is not exported by virtual:vinext-*"  — handled gracefully at runtime
*/
function createBuildLogger(vite) {
	const logger = vite.createLogger("info", { allowClearScreen: false });
	const originalInfo = logger.info.bind(logger);
	const originalWarn = logger.warn.bind(logger);
	const strip = (s) => s.replace(/\x1b\[[0-9;]*m/g, "");
	logger.info = (msg, options) => {
		const plain = strip(msg);
		if (plain.trimStart().startsWith("✓")) {
			originalInfo(msg, options);
			return;
		}
		if (/^vite v\d/.test(plain.trim())) return;
		if (/^(transforming|rendering chunks|computing gzip size)/.test(plain.trim())) return;
		if (/^(Initially,|After merging|are below minChunkSize)/.test(plain.trim())) return;
		if (/^\s*$/.test(plain)) return;
		if (/^\s*(dist\/|\.\/)/.test(plain)) return;
		// @vitejs/plugin-rsc environment section headers ("[rsc]", "[ssr]", "[client]", "[worker]").
		if (/^\s*\[(rsc|ssr|client|worker)\]/.test(plain)) return;
		originalInfo(msg, options);
	};
	logger.warn = (msg, options) => {
		const plain = strip(msg);
		if (plain.includes("dynamic import will not move module into another chunk")) return;
		if (plain.includes("is not exported by") && plain.includes("virtual:vinext")) return;
		originalWarn(msg, options);
	};
	return logger;
}
function hasPagesDir() {
	return fs.existsSync(path.join(process.cwd(), "pages")) || fs.existsSync(path.join(process.cwd(), "src", "pages"));
}
async function loadBuildViteConfigMetadata(vite, root) {
	if (!hasViteConfig(root)) return {
		nextConfig: null,
		prerenderConfig: null,
		routeRootConfig: null
	};
	const loaded = await vite.loadConfigFromFile({
		command: "build",
		mode: "production"
	}, void 0, root);
	const emptyOutDir = loaded?.config.build?.emptyOutDir;
	return {
		emptyOutDir: typeof emptyOutDir === "boolean" ? emptyOutDir : void 0,
		nextConfig: await findVinextNextConfigInPlugins(loaded?.config.plugins),
		prerenderConfig: await findVinextPrerenderConfigInPlugins(loaded?.config.plugins),
		routeRootConfig: await findVinextRouteRootConfigInPlugins(loaded?.config.plugins)
	};
}
/**
* Build the Vite config automatically. If a vite.config.ts exists in the
* project, Vite will merge our config with it (theirs takes precedence).
* If there's no vite.config, this provides everything needed.
*/
function buildViteConfig(overrides = {}, logger) {
	if (hasViteConfig(process.cwd())) return {
		root: process.cwd(),
		...logger ? { customLogger: logger } : {},
		...overrides
	};
	return {
		root: process.cwd(),
		configFile: false,
		plugins: [vinext()],
		resolve: { dedupe: [
			"react",
			"react-dom",
			"react/jsx-runtime",
			"react/jsx-dev-runtime"
		] },
		...logger ? { customLogger: logger } : {},
		...overrides
	};
}
/**
* Ensure the project's package.json has `"type": "module"` before Vite loads
* the vite.config.ts. This prevents the esbuild CJS-bundling path that Vite
* takes for projects without `"type": "module"`, which produces a `.mjs` temp
* file containing `require()` calls — calls that fail on Node 22 when
* targeting pure-ESM packages like `@cloudflare/vite-plugin`.
*
* This mirrors what `vinext init` does, but is applied lazily at dev/build
* time for projects that were set up before `vinext init` added the step, or
* that were migrated manually.
*/
function applyViteConfigCompatibility(root) {
	const result = ensureViteConfigCompatibility(root);
	if (!result) return;
	for (const [oldName, newName] of result.renamed) console.warn(`  [vinext] Renamed ${oldName} → ${newName} (required for "type": "module")`);
	if (result.addedTypeModule) console.warn("  [vinext] Added \"type\": \"module\" to package.json (required for Vite ESM config loading).\n  Run `vinext init` to review all project configuration.");
}
async function dev() {
	const parsed = parseArgs(rawArgs);
	if (parsed.help) return printHelp("dev");
	loadDotenv({
		root: process.cwd(),
		mode: "development"
	});
	applyViteConfigCompatibility(process.cwd());
	const vite = await loadVite();
	const initialPort = parsed.port ?? 3e3;
	const initialHost = parsed.hostname ?? "localhost";
	let lockfile;
	const startedAt = Date.now();
	if (process.env.VINEXT_NO_DEV_LOCK !== "1") {
		const root = process.cwd();
		const initialDisplayHost = initialHost === "0.0.0.0" ? "localhost" : initialHost;
		const acquired = tryAcquireLockfile({
			root,
			info: {
				pid: process.pid,
				port: initialPort,
				hostname: initialHost,
				appUrl: `http://${initialDisplayHost}:${initialPort}`,
				startedAt,
				cwd: root
			}
		});
		if (!acquired.ok) {
			console.error("\n  " + formatAlreadyRunningError({
				existing: acquired.existing,
				cwd: root,
				lockfilePath: acquired.lockfilePath
			}).replace(/\n/g, "\n  ") + "\n");
			process.exit(1);
		}
		lockfile = acquired.lockfile;
	}
	console.log(`\n  vinext dev  (Vite ${getViteVersion()})\n`);
	const config = buildViteConfig();
	(config.plugins ??= []).push(createDevServerConfigPlugin(parsed));
	let server;
	try {
		server = await vite.createServer(config);
		const port = server.config.server.port ?? 3e3;
		const host = normalizeDevServerHostname(server.config.server.host);
		lockfile?.update({
			pid: process.pid,
			port,
			hostname: host,
			appUrl: `http://${host === "0.0.0.0" ? "localhost" : host}:${port}`,
			startedAt,
			cwd: process.cwd()
		});
		await server.listen();
	} catch (err) {
		lockfile?.release();
		throw err;
	}
	server.printUrls();
	if (lockfile) {
		const configuredPort = server.config.server.port ?? 3e3;
		const configuredHost = normalizeDevServerHostname(server.config.server.host);
		const resolved = server.resolvedUrls?.local[0];
		let actualPort = configuredPort;
		let appUrl;
		if (resolved) {
			appUrl = resolved.replace(/\/$/, "");
			try {
				const parsed = new URL(appUrl);
				actualPort = parsed.port ? Number.parseInt(parsed.port, 10) : actualPort;
			} catch {}
		} else {
			const address = server.httpServer?.address();
			actualPort = typeof address === "object" && address ? address.port : configuredPort;
			appUrl = `http://${configuredHost === "0.0.0.0" ? "localhost" : configuredHost}:${actualPort}`;
		}
		lockfile.update({
			pid: process.pid,
			port: actualPort,
			hostname: configuredHost,
			appUrl,
			startedAt,
			cwd: process.cwd()
		});
	}
}
async function buildApp() {
	const parsed = parseArgs(rawArgs);
	if (parsed.help) return printHelp("build");
	if (parsed.precompress) process.env.VINEXT_PRECOMPRESS = "1";
	loadDotenv({
		root: process.cwd(),
		mode: "production"
	});
	applyViteConfigCompatibility(process.cwd());
	const vite = await loadVite();
	const withBuildBundlerOptions = (bundlerOptions) => ({ rolldownOptions: bundlerOptions });
	console.log(`\n  vinext build  (Vite ${getViteVersion()})\n`);
	const root = toSlash(process.cwd());
	const isApp = hasAppDir(root);
	const buildConfigMetadata = await loadBuildViteConfigMetadata(vite, root);
	const resolvedNextConfig = await resolveNextConfig(buildConfigMetadata.nextConfig ? await resolveNextConfigInput(buildConfigMetadata.nextConfig, PHASE_PRODUCTION_BUILD) : await loadNextConfig(root, PHASE_PRODUCTION_BUILD), root);
	process.env.__VINEXT_SHARED_BUILD_ID = resolvedNextConfig.buildId;
	process.env.__VINEXT_SHARED_RSC_COMPATIBILITY_ID = createRscCompatibilityId(resolvedNextConfig);
	if (!process.env.__VINEXT_SHARED_REVALIDATE_SECRET) process.env.__VINEXT_SHARED_REVALIDATE_SECRET = randomBytes(32).toString("hex");
	const outputMode = resolvedNextConfig.output;
	const distDir = path.resolve(root, "dist");
	if (outputMode === "standalone") {
		const vinextDistDir = path.join(resolveVinextPackageRoot(), "dist");
		if (!fs.existsSync(vinextDistDir)) {
			console.error(`  Error: vinext dist/ not found at ${vinextDistDir}. Run \`pnpm run build\` in the vinext package first.`);
			process.exit(1);
		}
	}
	const logger = parsed.verbose ? vite.createLogger("info", { allowClearScreen: false }) : createBuildLogger(vite);
	if (isApp) {
		const reactUpgrade = getReactUpgradeDeps(process.cwd());
		if (reactUpgrade.length > 0) {
			const [pm, ...pmArgs] = detectPackageManager(process.cwd()).replace(/ -D$/, "").split(" ");
			console.log("  Upgrading React for RSC compatibility...");
			execFileSync(pm, [...pmArgs, ...reactUpgrade], {
				cwd: process.cwd(),
				stdio: "inherit",
				shell: process.platform === "win32"
			});
		}
	}
	cleanBuildOutput({
		root,
		outDir: distDir,
		emptyOutDir: buildConfigMetadata.emptyOutDir
	});
	const isHybrid = isApp && hasPagesDir();
	const pagesClientAssetsBuildSession = isHybrid ? randomBytes(16).toString("hex") : null;
	if (pagesClientAssetsBuildSession) process.env.__VINEXT_PAGES_CLIENT_ASSETS_BUILD_SESSION = pagesClientAssetsBuildSession;
	await runWithPreviewBuildCredentials(async () => {
		try {
			const config = buildViteConfig({}, logger);
			await (await vite.createBuilder(config)).buildApp();
			if (isHybrid) {
				console.log("  Building Pages Router server (hybrid)...");
				const root = process.cwd();
				let userTransformPlugins = [];
				if (hasViteConfig(process.cwd())) {
					const loaded = await vite.loadConfigFromFile({
						command: "build",
						mode: "production",
						isSsrBuild: true
					}, void 0, root);
					if (loaded?.config.plugins) userTransformPlugins = loaded.config.plugins.flat(Infinity).filter((p) => !!p && typeof p.name === "string" && !p.name.startsWith("vinext:") && !p.name.startsWith("vite:react") && !p.name.startsWith("rsc:") && p.name !== "vite-rsc-load-module-dev-proxy" && !p.name.startsWith("vite-plugin-cloudflare"));
				}
				await vite.build({
					root,
					configFile: false,
					plugins: [...userTransformPlugins, vinext({ disableAppRouter: true })],
					resolve: { dedupe: [
						"react",
						"react-dom",
						"react/jsx-runtime",
						"react/jsx-dev-runtime"
					] },
					...logger ? { customLogger: logger } : {},
					build: {
						outDir: "dist/server",
						emptyOutDir: false,
						ssr: "virtual:vinext-server-entry",
						...withBuildBundlerOptions({ output: { entryFileNames: "entry.js" } })
					}
				});
			}
		} finally {
			if (pagesClientAssetsBuildSession) {
				clearPagesClientAssetsBuildMetadata(pagesClientAssetsBuildSession);
				if (process.env.__VINEXT_PAGES_CLIENT_ASSETS_BUILD_SESSION === pagesClientAssetsBuildSession) delete process.env.__VINEXT_PAGES_CLIENT_ASSETS_BUILD_SESSION;
			}
		}
	});
	if (outputMode === "standalone") {
		const standalone = emitStandaloneOutput({
			root: process.cwd(),
			outDir: distDir
		});
		console.log(`  Generated standalone output in ${path.relative(process.cwd(), standalone.standaloneDir)}/`);
		console.log("  Start it with: node dist/standalone/server.js\n");
		return process.exit(0);
	}
	let prerenderResult;
	const prerenderDecision = resolveVinextPrerenderDecision({
		prerenderAllFlag: parsed.prerenderAll,
		vinextPrerenderConfig: buildConfigMetadata.prerenderConfig,
		nextOutput: resolvedNextConfig.output
	});
	if (prerenderDecision) {
		if (resolvedNextConfig.enablePrerenderSourceMaps) {
			process.setSourceMapsEnabled(true);
			Error.stackTraceLimit = Math.max(Error.stackTraceLimit, 50);
		}
		process.stdout.write("\x1B[0m");
		console.log(`  ${formatVinextPrerenderLabel(prerenderDecision)}`);
		prerenderResult = await runPrerender({
			root,
			concurrency: parsed.prerenderConcurrency,
			nextConfig: resolvedNextConfig
		});
		await emitPrerenderPathManifest({
			root,
			nextConfig: resolvedNextConfig,
			routeRootConfig: buildConfigMetadata.routeRootConfig
		});
	}
	process.stdout.write("\x1B[0m");
	const { printBuildReport } = await import("./build/report.js");
	await printBuildReport({
		root,
		pageExtensions: resolvedNextConfig.pageExtensions,
		prerenderResult: prerenderResult ?? void 0
	});
	console.log("\n  Build complete. Run `vinext start` to start the production server.\n");
	process.exit(0);
}
async function start() {
	const parsed = parseArgs(rawArgs);
	if (parsed.help) return printHelp("start");
	loadDotenv({
		root: process.cwd(),
		mode: "production"
	});
	const port = parsed.port ?? parseInt(process.env.PORT ?? "3000", 10);
	const host = parsed.hostname ?? "0.0.0.0";
	console.log(`\n  vinext start  (port ${port})\n`);
	const { startProdServer } = await import(
		/* @vite-ignore */
		"./server/prod-server.js"
);
	await startProdServer({
		port,
		host,
		outDir: path.resolve(process.cwd(), "dist")
	});
}
async function lint() {
	if (parseArgs(rawArgs).help) return printHelp("lint");
	console.log(`\n  vinext lint\n`);
	const cwd = process.cwd();
	const hasOxlint = fs.existsSync(path.join(cwd, "node_modules", ".bin", "oxlint"));
	const hasEslint = fs.existsSync(path.join(cwd, "node_modules", ".bin", "eslint"));
	const hasNextLintConfig = fs.existsSync(path.join(cwd, ".eslintrc.json")) || fs.existsSync(path.join(cwd, ".eslintrc.js")) || fs.existsSync(path.join(cwd, ".eslintrc.cjs")) || fs.existsSync(path.join(cwd, "eslint.config.js")) || fs.existsSync(path.join(cwd, "eslint.config.mjs"));
	try {
		if (hasEslint && hasNextLintConfig) {
			console.log("  Using eslint (with existing config)\n");
			execFileSync("npx", ["eslint", "."], {
				cwd,
				stdio: "inherit",
				shell: process.platform === "win32"
			});
		} else if (hasOxlint) {
			console.log("  Using oxlint\n");
			execFileSync("npx", ["oxlint", "."], {
				cwd,
				stdio: "inherit",
				shell: process.platform === "win32"
			});
		} else if (hasEslint) {
			console.log("  Using eslint\n");
			execFileSync("npx", ["eslint", "."], {
				cwd,
				stdio: "inherit",
				shell: process.platform === "win32"
			});
		} else {
			console.log("  No linter found. Install eslint or oxlint:\n\n    " + detectPackageManager(process.cwd()) + " eslint eslint-config-next\n    # or\n    " + detectPackageManager(process.cwd()) + " oxlint\n");
			process.exit(1);
		}
		console.log("\n  Lint passed.\n");
	} catch {
		process.exit(1);
	}
}
function failRemovedDeployCommand() {
	console.error("\n  Error: `vinext deploy` has moved to the `@vinext/cloudflare` package.\n\n  Run `npx @vinext/cloudflare deploy` or `vp exec vinext-cloudflare deploy` instead.\n");
	process.exit(1);
}
async function check() {
	if (parseArgs(rawArgs).help) return printHelp("check");
	console.log(`\n  vinext check\n`);
	console.log("  Scanning project...\n");
	const result = runCheck(toSlash(process.cwd()));
	console.log(formatReport(result));
}
async function typegen() {
	const parsed = parseArgs(rawArgs);
	if (parsed.help) return printHelp("typegen");
	const root = path.resolve(parsed.positionals?.[0] ?? process.cwd());
	loadDotenv({
		root,
		mode: "production"
	});
	const result = await generateRouteTypes({
		root,
		pageExtensions: (await resolveNextConfig(await loadNextConfig(root, PHASE_PRODUCTION_BUILD), root)).pageExtensions
	});
	const nextEnvMessage = result.nextEnvStatus === "unchanged" ? `${path.relative(root, result.nextEnvPath)} is up to date` : `${result.nextEnvStatus === "created" ? "Created" : "Updated"} ${path.relative(root, result.nextEnvPath)}`;
	console.log(`\n  Generated route types at ${path.relative(root, result.routeTypesPath)}\n  ${nextEnvMessage}\n`);
}
async function initCommand() {
	const parsed = parseArgs(rawArgs);
	if (parsed.help) return printHelp("init");
	console.log(`\n  vinext init\n`);
	const port = parsed.port ?? 3001;
	const skipCheck = rawArgs.includes("--skip-check");
	const force = rawArgs.includes("--force");
	const initOptions = await resolveInitOptions(rawArgs);
	await init({
		root: process.cwd(),
		port,
		skipCheck,
		force,
		...initOptions
	});
}
function printHelp(cmd) {
	if (cmd === "dev") {
		console.log(`
  vinext dev - Start development server

  Usage: vinext dev [options]

  Options:
    -p, --port <port>        Port to listen on (default: 3000)
    -H, --hostname <host>    Hostname to bind to (default: localhost)
    --turbopack              Accepted for compatibility (no-op, Vite is always used)
    -h, --help               Show this help
`);
		return;
	}
	if (cmd === "build") {
		console.log(`
  vinext build - Build for production

  Usage: vinext build [options]

  Automatically detects App Router (app/) or Pages Router (pages/) and
  runs the appropriate multi-environment build via Vite.
  If next.config sets output: "standalone", also emits dist/standalone/server.js.

  Options:
    --verbose            Show full Vite/Rollup build output (suppressed by default)
    --prerender-all      Pre-render discovered routes after building. Equivalent
                         to vinext({ prerender: true }) and takes priority.
    --prerender-concurrency <count>
                         Maximum number of routes to pre-render in parallel
    --precompress        Precompress static assets at build time (.br, .gz, .zst)
    -h, --help           Show this help
`);
		return;
	}
	if (cmd === "start") {
		console.log(`
  vinext start - Start production server

  Usage: vinext start [options]

  Serves the output from \`vinext build\`. Supports SSR, static files,
  compression, and all middleware.
  For output: "standalone", you can also run: node dist/standalone/server.js

  Options:
    -p, --port <port>        Port to listen on (default: 3000, or PORT env)
    -H, --hostname <host>    Hostname to bind to (default: 0.0.0.0)
    -h, --help               Show this help
`);
		return;
	}
	if (cmd === "deploy") failRemovedDeployCommand();
	if (cmd === "check") {
		console.log(`
  vinext check - Scan Next.js app for compatibility

  Usage: vinext check [options]

  Scans your Next.js project and produces a compatibility report showing
  which imports, config options, libraries, and conventions are supported,
  partially supported, or unsupported by vinext.

  Options:
    -h, --help    Show this help
`);
		return;
	}
	if (cmd === "init") {
		console.log(`
  vinext init - Migrate a Next.js project to run under vinext

  Usage: vinext init [options]

  One-command migration: installs dependencies, configures ESM,
  generates vite.config.ts, and adds npm scripts. Your Next.js
  setup continues to work alongside vinext.

  Options:
    -p, --port <port>    Dev server port for the vinext script (default: 3001)
    --skip-check         Skip the compatibility check step
    --force              Overwrite existing vite.config.ts
    --platform <target>  Deployment target: cloudflare or node
    --prerender          Configure vinext build to pre-render all static routes
                         (default: prompt, with No selected by default)
    --experimental-warm-cdn-cache
                         Add experimental CDN pre-warming to the Cloudflare deploy script
                         (Workers Cache CDN only, default: prompt with No)
    --cdn-cache <type>   Cloudflare CDN cache: workers-cache or data-cache
                         (default: workers-cache)
    --data-cache <type>  Cloudflare data cache: kv or none (default: kv)
    --image-optimization <type>
                         Cloudflare image optimization: cloudflare-images or none
    -h, --help           Show this help

  Examples:
    vinext init                   Prompt for a deployment platform
    vinext init --platform=cloudflare  Configure Cloudflare Workers (default)
    vinext init --platform=cloudflare --cdn-cache=data-cache
                                Fall through CDN caching to the data cache
    vinext init --platform=cloudflare --data-cache=kv
                                Configure the default Cloudflare cache handlers
    vinext init --platform=cloudflare --image-optimization=none
                                Do not configure Cloudflare Images
    vinext init --prerender     Add prerender: { routes: "*" } to vite.config.ts
    vinext init --experimental-warm-cdn-cache
                                Add experimental CDN pre-warming to deploy:vinext
    vinext init --platform=node   Configure a Node deployment
    vinext init -p 4000           Use port 4000 for dev:vinext
    vinext init --force           Overwrite existing vite.config.ts
    vinext init --skip-check      Skip the compatibility report
`);
		return;
	}
	if (cmd === "typegen") {
		console.log(`
  vinext typegen - Generate App Router route helper types

  Usage: vinext typegen [directory] [options]

  Generates Next-compatible global route helpers for App Router projects:
  PageProps, LayoutProps, and RouteContext. Output is written to
  .next/types/routes.d.ts under the target directory.

  Options:
    -h, --help    Show this help
`);
		return;
	}
	if (cmd === "lint") {
		console.log(`
  vinext lint - Run linter

  Usage: vinext lint [options]

  Delegates to your project's eslint (with eslint-config-next) or oxlint.
  If neither is installed, suggests how to add one.

  Options:
    -h, --help    Show this help
`);
		return;
	}
	console.log(`
  vinext v${VERSION} - Run Next.js apps on Vite

  Usage: vinext <command> [options]

  Commands:
    dev      Start development server
    build    Build for production
    start    Start production server
    typegen  Generate App Router route helper types
    init     Migrate a Next.js project to vinext
    check    Scan Next.js app for compatibility
    lint     Run linter

  Options:
    -h, --help     Show this help
    --version      Show version

  Examples:
    vinext dev                         Start dev server on port 3000
    vinext dev -p 4000                 Start dev server on port 4000
    vinext build                       Build for production
    vinext typegen                     Generate route helper types
    vinext start                       Start production server
    vinext init                        Migrate a Next.js project
    vinext check                       Check compatibility
    vinext lint                        Run linter
    npx @vinext/cloudflare deploy      Deploy to Cloudflare Workers
    vp exec vinext-cloudflare deploy   Deploy to Cloudflare Workers with Vite+

  vinext is a drop-in replacement for the \`next\` CLI.
  No vite.config.ts needed — just run \`vinext dev\` in your Next.js project.
`);
}
if (command === "--version" || command === "-v") {
	console.log(`vinext v${VERSION}`);
	process.exit(0);
}
if (command === "--help" || command === "-h" || !command) {
	printHelp();
	process.exit(0);
}
switch (command) {
	case "dev":
		dev().catch((e) => {
			console.error(e);
			process.exit(1);
		});
		break;
	case "build":
		buildApp().catch((e) => {
			console.error(e);
			process.exit(1);
		});
		break;
	case "start":
		start().catch((e) => {
			console.error(e);
			process.exit(1);
		});
		break;
	case "deploy":
		failRemovedDeployCommand();
		break;
	case "init":
		initCommand().catch((e) => {
			console.error(e);
			process.exit(1);
		});
		break;
	case "check":
		check().catch((e) => {
			console.error(e);
			process.exit(1);
		});
		break;
	case "typegen":
		typegen().catch((e) => {
			console.error(e);
			process.exit(1);
		});
		break;
	case "lint":
		lint().catch((e) => {
			console.error(e);
			process.exit(1);
		});
		break;
	default:
		console.error(`\n  Unknown command: ${command}\n`);
		printHelp();
		process.exit(1);
}
//#endregion
export {};
