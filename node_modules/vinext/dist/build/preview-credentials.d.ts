//#region src/build/preview-credentials.d.ts
type PreviewBuildCredentials = {
  id: string;
  signingKey: string;
  encryptionKey: string;
};
declare function createPreviewBuildCredentials(): PreviewBuildCredentials;
declare function getPreviewBuildCredentials(): PreviewBuildCredentials | undefined;
declare function runWithPreviewBuildCredentials<T>(callback: () => T): T;
//#endregion
export { PreviewBuildCredentials, createPreviewBuildCredentials, getPreviewBuildCredentials, runWithPreviewBuildCredentials };