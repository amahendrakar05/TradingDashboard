//#region src/server/request-log.d.ts
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
type RequestLogOptions = {
  method: string;
  url: string;
  status: number; /** Total elapsed time in milliseconds (start → response finish). */
  totalMs: number; /** Time spent in Vite module loading / compilation. */
  compileMs?: number; /** Time spent in React rendering / HTML streaming. */
  renderMs?: number;
};
/**
 * Print a single request log line to stdout.
 */
declare function logRequest({
  method,
  url,
  status,
  totalMs,
  compileMs,
  renderMs
}: RequestLogOptions): void;
/**
 * Returns `performance.now()` - a high-resolution monotonic timestamp.
 */
declare function now(): number;
//#endregion
export { logRequest, now };