import { isNavigationSignalError } from "../utils/navigation-signal.js";
import { resolveAppPageSpecialError } from "./app-page-execution.js";
//#region src/server/app-rsc-errors.ts
const ORIGINAL_SERVER_ERROR = Symbol.for("vinext.originalServerError");
function hasDigest(error) {
	return Boolean(error && typeof error === "object" && "digest" in error);
}
const BAILOUT_TO_CSR_DIGEST = "BAILOUT_TO_CLIENT_SIDE_RENDERING";
const DYNAMIC_SERVER_USAGE_DIGEST = "DYNAMIC_SERVER_USAGE";
/**
* vinext's mirror of Next.js's `getDigestForWellKnownError`: returns the digest
* string only when the error is a genuine control-flow signal — a redirect,
* notFound/HTTP-access fallback, bail-out-to-client-side-rendering, or
* dynamic-server-usage throw. Any other digest (e.g. a hashed digest stamped on
* a real error, or an obfuscated digest transported from a nested boundary)
* returns undefined so the caller still reports it as a real error. Mere
* presence of a `digest` field is NOT enough — that conflation swallowed a class
* of server render errors with no instrumentation/telemetry.
*/
function getDigestForWellKnownError(error) {
	if (!hasDigest(error)) return;
	const digest = String(error.digest);
	if (isNavigationSignalError(error) || digest === BAILOUT_TO_CSR_DIGEST || digest === DYNAMIC_SERVER_USAGE_DIGEST) return digest;
}
function getThrownValueMessage(error) {
	return error instanceof Error ? error.message : String(error);
}
function getThrownValueStack(error) {
	return error instanceof Error ? error.stack || "" : "";
}
/**
* djb2 hash matching Next.js's string-hash package for RSC error digests.
*/
function errorDigest(input) {
	let hash = 5381;
	for (let i = input.length - 1; i >= 0; i--) hash = hash * 33 ^ input.charCodeAt(i);
	return (hash >>> 0).toString();
}
function sanitizeErrorForClient(error, nodeEnv = process.env.NODE_ENV) {
	if (resolveAppPageSpecialError(error)) return error;
	if (nodeEnv !== "production") return error;
	const sanitized = /* @__PURE__ */ new Error("An error occurred in the Server Components render. The specific message is omitted in production builds to avoid leaking sensitive details. A digest property is included on this error instance which may provide additional details about the nature of the error.");
	sanitized.digest = hasDigest(error) ? String(error.digest) : errorDigest(getThrownValueMessage(error) + getThrownValueStack(error));
	Object.defineProperty(sanitized, ORIGINAL_SERVER_ERROR, {
		configurable: false,
		enumerable: false,
		value: error,
		writable: false
	});
	return sanitized;
}
function createRscOnErrorHandler(options) {
	return (error) => {
		const nodeEnv = options.nodeEnv ?? process.env.NODE_ENV;
		const wellKnownDigest = getDigestForWellKnownError(error);
		if (wellKnownDigest !== void 0) return wellKnownDigest;
		if (nodeEnv !== "production" && error instanceof Error && error.message.includes("Only plain objects, and a few built-ins, can be passed to Client Components")) {
			console.error("[vinext] RSC serialization error: a non-plain object was passed from a Server Component to a Client Component.\n\nCommon causes:\n  * Passing a module namespace (import * as X) directly as a prop.\n    Unlike Next.js (webpack), Vite produces real ESM module namespace objects\n    which are not serializable. Fix: pass individual values instead,\n    e.g. <Comp value={module.value} />\n  * Passing a class instance (new Foo()) as a prop.\n    Fix: convert to a plain object, e.g. { id: foo.id, name: foo.name }\n  * Passing a Date, Map, or Set. Use .toISOString(), [...map.entries()], etc.\n  * Passing Object.create(null). Use { ...obj } to restore a prototype.\n\nOriginal error:", error.message);
			return;
		}
		if (options.requestInfo && options.errorContext && error) {
			const reportableError = typeof error === "object" && ORIGINAL_SERVER_ERROR in error ? Reflect.get(error, ORIGINAL_SERVER_ERROR) : error;
			options.reportRequestError(reportableError instanceof Error ? reportableError : new Error(getThrownValueMessage(reportableError)), options.requestInfo, options.errorContext);
		}
		if (hasDigest(error)) return String(error.digest);
		if (error) {
			const digest = errorDigest(getThrownValueMessage(error) + getThrownValueStack(error));
			if (error instanceof Error) try {
				Object.assign(error, { digest });
			} catch {}
			return digest;
		}
	};
}
//#endregion
export { createRscOnErrorHandler, errorDigest, getDigestForWellKnownError, hasDigest, sanitizeErrorForClient };
