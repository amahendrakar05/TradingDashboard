//#region src/server/request-log.ts
/**
* Request logging for the vinext dev server.
*
* Matches Next.js's request log format:
*   GET /path 200 in 123ms (compile: 45ms, render: 78ms)
*
* Color coding matches Next.js:
*  - 2xx: green
*  - 3xx: cyan
*  - 4xx: yellow
*  - 5xx: red
*  - Method: bold
*/
const isTTY = () => process.stdout.isTTY;
const pretty = {
	bold: (s) => isTTY() ? `\x1b[1m${s}\x1b[0m` : s,
	green: (s) => isTTY() ? `\x1b[32m${s}\x1b[0m` : s,
	cyan: (s) => isTTY() ? `\x1b[36m${s}\x1b[0m` : s,
	yellow: (s) => isTTY() ? `\x1b[33m${s}\x1b[0m` : s,
	red: (s) => isTTY() ? `\x1b[31m${s}\x1b[0m` : s,
	dim: (s) => isTTY() ? `\x1b[2m${s}\x1b[0m` : s
};
function colorStatus(status, text) {
	if (status >= 500) return pretty.red(text);
	if (status >= 400) return pretty.yellow(text);
	if (status >= 300) return pretty.cyan(text);
	return pretty.green(text);
}
function formatDuration(ms) {
	if (ms >= 1e3) return `${(ms / 1e3).toFixed(1)}s`;
	return `${Math.round(ms)}ms`;
}
/**
* Print a single request log line to stdout.
*/
function logRequest({ method, url, status, totalMs, compileMs, renderMs }) {
	let line = [
		pretty.bold(method),
		url,
		colorStatus(status, String(status)),
		"in",
		formatDuration(totalMs)
	].join(" ");
	const parts = [compileMs !== void 0 && `compile: ${formatDuration(compileMs)}`, renderMs !== void 0 && `render: ${formatDuration(renderMs)}`].filter(Boolean);
	if (parts.length > 0) line += pretty.dim(` (${parts.join(", ")})`);
	process.stdout.write(" " + line + "\n");
}
/**
* Returns `performance.now()` - a high-resolution monotonic timestamp.
*/
function now() {
	return performance.now();
}
//#endregion
export { logRequest, now };
