import { ReportedError, dismissOverlay } from "./dev-error-overlay-store.js";

//#region src/client/dev-error-overlay.d.ts
declare const DEV_ERROR_OVERLAY_HOST_ID = "__vinext_dev_error_overlay_root";
declare const DEV_ERROR_OVERLAY_MOUNT_ID = "__vinext_dev_error_overlay_mount";
declare function installDevErrorOverlay(): void;
declare function installReactRefreshErrorRecovery(): void;
declare function reportInitialDevServerErrors(): void;
type ViteHmrErrorPayload = {
  err?: ViteHmrError;
};
type ViteHmrError = {
  [name: string]: unknown;
  message?: unknown;
  frame?: unknown;
  plugin?: unknown;
};
type NormalizedViteHmrError = {
  message: string;
};
declare function installViteHmrErrorHandler(hot: unknown): void;
declare function normalizeViteHmrError(payload: ViteHmrErrorPayload): NormalizedViteHmrError;
declare function devOnCaughtError(error: unknown, errorInfo: {
  componentStack?: string;
  errorBoundary?: unknown;
}): void;
declare function devOnUncaughtError(error: unknown, errorInfo: {
  componentStack?: string;
  errorBoundary?: unknown;
}): void;
declare function createDevErrorOverlayMountNode(ownerDocument: Document): HTMLElement;
type FrameLocation = {
  file?: string;
  line?: string;
  col?: string;
};
type ClipboardStackFrame = {
  fn: string;
  file?: string;
  displayFile?: string;
  line?: string;
  col?: string;
  ignored?: boolean;
};
type ClipboardErrorInfo = Pick<ReportedError, "source" | "message"> & Partial<Pick<ReportedError, "projectRoot" | "codeFrame" | "componentStack">>;
declare function formatOverlayDisplayFile(file: string, projectRoot?: string): string;
declare function formatErrorInfoForClipboard(error: ClipboardErrorInfo, frames: readonly ClipboardStackFrame[]): string;
declare function formatViteOpenInEditorFile(frame: FrameLocation): string | null;
declare function createViteOpenInEditorUrl(file: string, baseUrl?: string): string;
//#endregion
export { DEV_ERROR_OVERLAY_HOST_ID, DEV_ERROR_OVERLAY_MOUNT_ID, createDevErrorOverlayMountNode, createViteOpenInEditorUrl, devOnCaughtError, devOnUncaughtError, dismissOverlay, formatErrorInfoForClipboard, formatOverlayDisplayFile, formatViteOpenInEditorFile, installDevErrorOverlay, installReactRefreshErrorRecovery, installViteHmrErrorHandler, normalizeViteHmrError, reportInitialDevServerErrors };