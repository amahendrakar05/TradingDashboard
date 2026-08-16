//#region src/utils/error-cause.ts
/**
* Embed an Error's `.cause` chain into its own `.message` and `.stack` so
* single-pass formatters (Vite's "Internal server error: ${err.message}\n${err.stack}"
* dev-server logger, anything that just prints message + stack) reveal the
* underlying root cause instead of silently dropping it.
*
* Without this, a wrapper like `new Error("Failed query", { cause: pgError })`
* shows up in the Vite dev console as just "Failed query" — the actual
* ECONNREFUSED / role-missing / socket-error in `.cause` is lost.
*
* Intended for **dev-server use only**. Production loggers (Node's
* `console.error` → `util.inspect`, workerd's runtime logger) already render
* `.cause` natively, so calling this in prod would double-print the cause —
* once in the synthesized message, once in util.inspect's `[cause]:` block.
* Callers should gate on `process.env.NODE_ENV !== "production"` (Vite
* build-time-replaces this, so the prod bundle gets a no-op).
*
* - Best-effort: never throws. Frozen / non-extensible errors are left untouched.
* - Idempotent (repeat calls are no-ops via a non-enumerable module-private symbol).
* - Cycle-safe and depth-capped (10) for pathological cause graphs.
* - Cause stack frames are appended as `at` lines so stack-cleaning regexes
*   like Vite's `/^\s*at/` filter preserve them.
*/
const FLATTENED_MARKER = Symbol("vinext.errorCausesFlattened");
const MAX_CAUSE_DEPTH = 10;
function stringifyNonError(value) {
	if (typeof value === "string") return value;
	if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") return String(value);
	if (value === null || value === void 0) return String(value);
	try {
		return JSON.stringify(value) ?? Object.prototype.toString.call(value);
	} catch {
		return Object.prototype.toString.call(value);
	}
}
function flattenErrorCauses(err) {
	if (!(err instanceof Error)) return;
	const marked = err;
	if (marked[FLATTENED_MARKER]) return;
	try {
		Object.defineProperty(marked, FLATTENED_MARKER, {
			value: true,
			enumerable: false,
			configurable: false,
			writable: false
		});
	} catch {
		return;
	}
	const seen = new WeakSet([err]);
	const causes = [];
	let cur = err.cause;
	let depth = 0;
	while (cur != null && depth < MAX_CAUSE_DEPTH) {
		if (typeof cur === "object") {
			if (seen.has(cur)) break;
			seen.add(cur);
		}
		if (cur instanceof Error) {
			causes.push({
				message: cur.message,
				stack: cur.stack
			});
			cur = cur.cause;
		} else {
			causes.push({ message: stringifyNonError(cur) });
			cur = null;
		}
		depth++;
	}
	if (causes.length === 0) return;
	const messageSuffix = causes.map((c) => `  [cause]: ${c.message}`).join("\n");
	try {
		err.message = `${err.message}\n${messageSuffix}`;
	} catch {
		return;
	}
	if (typeof err.stack === "string") {
		let stackSuffix = "";
		for (const c of causes) {
			const headline = c.message.split("\n", 1)[0];
			stackSuffix += `\n    at [cause: ${headline}]`;
			if (c.stack) {
				const frames = c.stack.split("\n").filter((l) => /^\s*at\s/.test(l)).join("\n");
				if (frames) stackSuffix += `\n${frames}`;
			}
		}
		try {
			err.stack = `${err.stack}${stackSuffix}`;
		} catch {}
	}
}
//#endregion
export { flattenErrorCauses };
