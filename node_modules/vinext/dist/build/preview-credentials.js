import { AsyncLocalStorage } from "node:async_hooks";
import { randomBytes } from "node:crypto";
//#region src/build/preview-credentials.ts
const previewBuildCredentialsStorage = new AsyncLocalStorage();
function createPreviewBuildCredentials() {
	return {
		id: randomBytes(16).toString("hex"),
		signingKey: randomBytes(32).toString("hex"),
		encryptionKey: randomBytes(32).toString("hex")
	};
}
function getPreviewBuildCredentials() {
	return previewBuildCredentialsStorage.getStore();
}
function runWithPreviewBuildCredentials(callback) {
	return previewBuildCredentialsStorage.run(createPreviewBuildCredentials(), callback);
}
//#endregion
export { createPreviewBuildCredentials, getPreviewBuildCredentials, runWithPreviewBuildCredentials };
