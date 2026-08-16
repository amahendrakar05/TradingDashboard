import { NoOpCacheHandler, setCacheHandler } from "../shims/cache-handler.js";
import { startProdServer } from "../server/prod-server.js";
//#region src/build/prerender-server-entry.ts
/**
* Child-process entry for a parallel prerender render server.
*
* Forked by `prerender-server-pool.ts`. React SSR/RSC rendering is CPU-bound
* JS, so a single-process promise pool serializes every render on one core.
* This entry lets the prerender phase fan rendering out across N OS processes
* (one per core, like Next.js's static worker pool): each child starts a normal
* vinext production server on an ephemeral port and reports it to the parent
* over IPC. The parent then load-balances per-route fetches across the pool.
*
* `VINEXT_PRERENDER` / `VINEXT_PRERENDER_OUTDIR` are passed via the fork env so
* they are set before any module loads (some server modules read the flag at
* import time).
*/
async function main() {
	const outDir = process.env.VINEXT_PRERENDER_OUTDIR;
	if (!outDir) throw new Error("[vinext] prerender server worker: VINEXT_PRERENDER_OUTDIR not set");
	setCacheHandler(new NoOpCacheHandler());
	const { port } = await startProdServer({
		port: 0,
		host: "127.0.0.1",
		outDir,
		noCompression: true,
		purpose: "prerender",
		silent: true
	});
	if (typeof process.send === "function") process.send({
		type: "ready",
		port
	});
	else throw new Error("[vinext] prerender server worker: no IPC channel to parent");
}
process.on("disconnect", () => process.exit(0));
main().catch((err) => {
	const message = err instanceof Error ? err.stack ?? err.message : String(err);
	if (typeof process.send === "function") {
		process.send({
			type: "error",
			error: message
		}, () => process.exit(1));
		return;
	}
	process.exit(1);
});
//#endregion
export {};
