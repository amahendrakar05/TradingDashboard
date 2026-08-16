import { isPprFallbackShellAbortError, preparePprFallbackShellFinalRender, waitForPprFallbackShellCacheReady } from "../shims/ppr-fallback-shell.js";
import { readAppPageBinaryStream } from "./app-page-execution.js";
//#region src/server/app-ppr-fallback-shell-render.ts
async function warmPprFallbackShellCaches(options) {
	let warmupError = null;
	const warmupDrain = readAppPageBinaryStream(options.renderToReadableStream(options.element, {
		signal: options.state.abortController.signal,
		onError(error, requestInfo, errorContext) {
			if (options.state.abortController.signal.aborted || isPprFallbackShellAbortError(error)) return;
			return options.onError(error, requestInfo, errorContext);
		}
	})).catch((error) => {
		if (options.state.abortController.signal.aborted || isPprFallbackShellAbortError(error)) return;
		warmupError = error;
	});
	try {
		await waitForPprFallbackShellCacheReady(options.state);
	} finally {
		options.state.abortController.abort();
		await warmupDrain;
		preparePprFallbackShellFinalRender(options.state);
	}
	if (warmupError) throw warmupError;
}
//#endregion
export { warmPprFallbackShellCaches };
