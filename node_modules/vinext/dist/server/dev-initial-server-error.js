import { createInlineScriptTag, safeJsonStringify } from "./html.js";
//#region src/server/dev-initial-server-error.ts
const INITIAL_DEV_SERVER_ERRORS_GLOBAL = "__VINEXT_INITIAL_DEV_ERRORS__";
function stringifyThrownValue(error) {
	if (typeof error === "string") return error;
	try {
		return String(error);
	} catch {
		return Object.prototype.toString.call(error);
	}
}
function createInitialDevServerErrorPayload(error) {
	if (error instanceof Error) return {
		message: error.message,
		name: error.name || void 0,
		stack: error.stack || void 0
	};
	return { message: stringifyThrownValue(error) };
}
function createInitialDevServerErrorScript(error, scriptNonce, nodeEnv = process.env.NODE_ENV) {
	if (error == null || nodeEnv === "production") return "";
	const globalRef = "self[" + safeJsonStringify(INITIAL_DEV_SERVER_ERRORS_GLOBAL) + "]";
	return createInlineScriptTag(`${globalRef}=${globalRef}||[];${globalRef}.push(${safeJsonStringify(createInitialDevServerErrorPayload(error))})`, scriptNonce);
}
//#endregion
export { createInitialDevServerErrorScript };
