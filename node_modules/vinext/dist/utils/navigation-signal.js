//#region src/utils/navigation-signal.ts
function getErrorDigest(error) {
	if (!error || typeof error !== "object" || !("digest" in error)) return null;
	return String(error.digest);
}
function isNavigationSignalError(error) {
	const digest = getErrorDigest(error);
	if (digest === null) return false;
	return digest === "NEXT_NOT_FOUND" || digest.startsWith("NEXT_HTTP_ERROR_FALLBACK;") || digest.startsWith("NEXT_REDIRECT;");
}
//#endregion
export { isNavigationSignalError };
