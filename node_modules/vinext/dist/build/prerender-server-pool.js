import path from "../deps/.pnpm/pathslash@0.1.0/deps/pathslash/dist/index.js";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import os from "node:os";
import { fork } from "node:child_process";
//#region src/build/prerender-server-pool.ts
/**
* Parallel prerender server pool.
*
* React SSR/RSC rendering during prerender is CPU-bound JS. vinext renders
* every route by fetching it from a single in-process production server, so the
* promise pool in `prerender.ts` only overlaps I/O — the actual rendering
* serializes on one core. This module forks a pool of OS processes (one vinext
* production server each, on its own ephemeral port) so the prerender phase can
* spread rendering across cores, mirroring Next.js's static worker pool. The
* caller load-balances per-route fetches across `ports`.
*
* child_process (not worker_threads) is deliberate: worker threads share the
* process and contend badly for CPU on this workload (measured ~2× slower
* per route and non-scaling), which is also why Next.js uses processes.
*/
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORKER_ENTRY = path.join(__dirname, "prerender-server-entry.js");
/**
* Whether the forkable worker entry exists as a runnable `.js` sibling. False
* when vinext runs from source (e.g. the test suite transpiles `.ts` on the
* fly and a forked plain-node child can't load `.ts`); callers fall back to the
* single in-process server. True in the published/built package.
*/
function prerenderPoolAvailable() {
	return fs.existsSync(WORKER_ENTRY);
}
/** Hard cap on render processes. Beyond this the main thread (which collects
* HTML and writes files) becomes the bottleneck, so more workers don't help. */
const MAX_POOL_SIZE = 8;
/** Don't fork a dedicated process unless a worker gets at least this many
* routes — below this the fork + bundle-import startup cost outweighs the
* parallel-render saving (measured: a 2-worker pool only reliably beats the
* single server from ~50 routes/worker up). */
const MIN_ROUTES_PER_WORKER = 48;
/** Rough memory budget reserved for the main build process plus its in-process
* prerender server. */
const APPROX_MAIN_PROCESS_BYTES = 768 * 1024 * 1024;
/** Rough memory budget per worker (a worker loads the whole server bundle).
* Used with total system memory as a coarse upper bound on constrained machines
* so K render processes don't OOM. Deliberately under-forks rather than risking
* OOM; measured mid-size apps are usually lower (~260-380 MB/worker). */
const APPROX_BYTES_PER_WORKER = 768 * 1024 * 1024;
/** Per-worker readiness timeout. */
const WORKER_READY_TIMEOUT_MS = 6e4;
/** Best-effort close timeout so build cleanup is not blocked forever by a wedged child. */
const WORKER_CLOSE_TIMEOUT_MS = 5e3;
const PRERENDER_WORKER_TRANSPORT_ERROR_CODES = /* @__PURE__ */ new Set([
	"ECONNREFUSED",
	"ECONNRESET",
	"EPIPE",
	"UND_ERR_SOCKET"
]);
/**
* Choose how many render processes to fork for `routeCount` routes.
*
* Returns 1 to mean "don't fork — render in-process as before" (small apps,
* single/dual-core, low memory, or an explicit `--prerender-concurrency 1`).
* `maxOverride` comes from `--prerender-concurrency`, which caps both the
* number of in-flight route fetches and the worker count (the default is capped
* at `min(cores, 8)`).
*/
function resolvePrerenderPoolSize(routeCount, maxOverride) {
	const cores = Math.max(1, os.availableParallelism());
	const byCores = Math.max(1, Math.min(cores - 1, MAX_POOL_SIZE));
	const memoryForWorkers = Math.max(0, os.totalmem() - APPROX_MAIN_PROCESS_BYTES);
	const byMemory = Math.max(1, Math.floor(memoryForWorkers / APPROX_BYTES_PER_WORKER));
	const cap = maxOverride && maxOverride > 0 ? Math.min(maxOverride, byCores) : byCores;
	const byRoutes = Math.floor(routeCount / MIN_ROUTES_PER_WORKER);
	return Math.max(1, Math.min(cap, byMemory, byRoutes));
}
function getErrorCauseCode(err) {
	if (!(err instanceof Error)) return void 0;
	const cause = err.cause;
	return typeof cause?.code === "string" ? cause.code : void 0;
}
function isWorkerTransportError(err) {
	const code = getErrorCauseCode(err);
	if (code && PRERENDER_WORKER_TRANSPORT_ERROR_CODES.has(code)) return true;
	return err instanceof TypeError && err.message === "fetch failed";
}
/**
* Fork `size` production servers against `outDir` and resolve once all are
* listening. Each child reports its port over IPC. Rejects (and tears down any
* already-started children) if any child fails to come up.
*/
async function startPrerenderServerPool(outDir, size, entry = WORKER_ENTRY) {
	const children = [];
	let shuttingDown = false;
	let crash = null;
	let renderTransportError = null;
	const close = async () => {
		shuttingDown = true;
		await Promise.all(children.map(closeChild));
	};
	try {
		const readies = Array.from({ length: size }, () => {
			const child = fork(entry, [], {
				cwd: process.cwd(),
				env: {
					...process.env,
					VINEXT_PRERENDER: "1",
					VINEXT_PRERENDER_OUTDIR: outDir
				},
				stdio: [
					"ignore",
					"inherit",
					"inherit",
					"ipc"
				]
			});
			children.push(child);
			return new Promise((resolve, reject) => {
				const timer = setTimeout(() => {
					reject(/* @__PURE__ */ new Error("[vinext] prerender render server did not start within 60s"));
				}, WORKER_READY_TIMEOUT_MS);
				const cleanupStartupListeners = () => {
					clearTimeout(timer);
					child.off("message", onMessage);
					child.off("error", onError);
					child.off("exit", onStartupExit);
				};
				const onMessage = (msg) => {
					cleanupStartupListeners();
					if (msg?.type === "ready" && typeof msg.port === "number") {
						child.once("exit", (code, signal) => {
							if (!shuttingDown && !crash) crash = {
								port: msg.port,
								code,
								signal
							};
						});
						resolve(msg.port);
					} else reject(/* @__PURE__ */ new Error(`[vinext] prerender render server failed: ${msg?.error ?? "unknown"}`));
				};
				const onError = (err) => {
					cleanupStartupListeners();
					reject(err);
				};
				const onStartupExit = (code, signal) => {
					if (code !== null || signal !== null) {
						cleanupStartupListeners();
						reject(/* @__PURE__ */ new Error(`[vinext] prerender render server exited during startup (code ${code}, signal ${signal})`));
					}
				};
				child.once("message", onMessage);
				child.once("error", onError);
				child.once("exit", onStartupExit);
			});
		});
		const ports = await Promise.all(readies);
		const recordRenderError = (err) => {
			if (!renderTransportError && isWorkerTransportError(err)) renderTransportError = err instanceof Error ? err : new Error(String(err));
		};
		const assertHealthy = () => {
			if (crash) throw new Error(`[vinext] A prerender render worker (port ${crash.port}) exited unexpectedly (code ${crash.code}, signal ${crash.signal}) during the build. Prerender output is incomplete; failing the build. This is often an out-of-memory kill — try a lower --prerender-concurrency.`);
			if (renderTransportError) {
				const causeCode = getErrorCauseCode(renderTransportError);
				throw new Error(`[vinext] A prerender render worker request failed` + (causeCode ? ` (${causeCode})` : "") + " before the worker exit was observed. Prerender output is incomplete; failing the build. This is often an out-of-memory kill — try a lower --prerender-concurrency.");
			}
		};
		return {
			ports,
			assertHealthy,
			recordRenderError,
			close
		};
	} catch (err) {
		await close();
		throw err;
	}
}
async function closeChild(child) {
	if (child.exitCode !== null || child.signalCode !== null) return;
	const exited = new Promise((resolve) => {
		const timer = setTimeout(resolve, WORKER_CLOSE_TIMEOUT_MS);
		timer.unref?.();
		const finish = () => {
			clearTimeout(timer);
			resolve();
		};
		child.once("exit", finish);
		if (child.exitCode !== null || child.signalCode !== null) finish();
	});
	if (!child.killed) child.kill("SIGKILL");
	await exited;
}
//#endregion
export { prerenderPoolAvailable, resolvePrerenderPoolSize, startPrerenderServerPool };
