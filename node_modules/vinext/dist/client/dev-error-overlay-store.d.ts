//#region src/client/dev-error-overlay-store.d.ts
type Source = "server" | "vite" | "uncaught" | "caught" | "window-error" | "unhandledrejection";
type ReportedError = {
  id: number;
  source: Source;
  message: string;
  stack: string | undefined;
  ignoredStackFrames: boolean[] | undefined;
  projectRoot: string | undefined;
  codeFrame: OverlayCodeFrame | undefined;
  componentStack: string | undefined;
};
type OverlayCodeFrame = {
  file: string;
  line: number;
  column: number;
  methodName?: string;
  lines: OverlayCodeFrameLine[];
};
type OverlayCodeFrameLine = {
  line: number;
  text: string;
  isErrorLine: boolean;
};
type OverlayState = {
  errors: ReportedError[];
  index: number;
  minimized: boolean;
};
declare function subscribeOverlay(fn: () => void): () => void;
declare function getOverlaySnapshot(): OverlayState;
declare function reportToOverlay(error: Omit<ReportedError, "id">): number;
declare function updateOverlayErrorStack(id: number, stack: string | undefined, ignoredStackFrames?: boolean[], codeFrame?: OverlayCodeFrame, projectRoot?: string): void;
declare function dismissOverlay(): void;
declare function setOverlayIndex(index: number): void;
declare function minimizeOverlay(): void;
declare function expandOverlay(): void;
//#endregion
export { OverlayCodeFrame, OverlayState, ReportedError, Source, dismissOverlay, expandOverlay, getOverlaySnapshot, minimizeOverlay, reportToOverlay, setOverlayIndex, subscribeOverlay, updateOverlayErrorStack };