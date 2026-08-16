import { isUnknownRecord } from "../utils/record.js";
import { isNavigationSignalError } from "../utils/navigation-signal.js";
//#region src/server/app-browser-error.ts
function isImplicitRootErrorBoundary(errorInfo) {
	if (!isUnknownRecord(errorInfo.errorBoundary)) return false;
	const props = errorInfo.errorBoundary.props;
	return isUnknownRecord(props) && props.isImplicitRootErrorBoundary === true;
}
function logCaughtError(error, errorInfo) {
	console.error(error);
	if (errorInfo?.componentStack) console.error("The above error occurred in a React component:\n" + errorInfo.componentStack);
}
function reportGlobalError(error) {
	if (typeof globalThis.reportError === "function") {
		globalThis.reportError(error);
		return;
	}
	console.error(error);
}
function createOnUncaughtError() {
	return (error) => {
		reportGlobalError(error);
	};
}
function createProdOnCaughtError(onImplicitRootError) {
	return (error, errorInfo) => {
		if (isNavigationSignalError(error)) return;
		if (isImplicitRootErrorBoundary(errorInfo)) {
			onImplicitRootError(error, errorInfo);
			return;
		}
		logCaughtError(error, errorInfo);
	};
}
function createDevOnCaughtError(onCaughtError, onImplicitRootError) {
	return (error, errorInfo) => {
		if (isImplicitRootErrorBoundary(errorInfo)) {
			onImplicitRootError(error, errorInfo);
			return;
		}
		onCaughtError(error, errorInfo);
	};
}
function prodOnCaughtError(error, errorInfo) {
	if (isNavigationSignalError(error)) return;
	logCaughtError(error, errorInfo);
}
function prodOnRecoverableError(error) {
	reportGlobalError(error instanceof Error && error.cause !== void 0 ? error.cause : error);
}
//#endregion
export { createDevOnCaughtError, createOnUncaughtError, createProdOnCaughtError, prodOnCaughtError, prodOnRecoverableError };
