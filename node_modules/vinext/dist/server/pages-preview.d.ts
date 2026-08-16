//#region src/server/pages-preview.d.ts
declare const PAGES_PREVIEW_CACHE_CONTROL = "private, no-cache, no-store, max-age=0, must-revalidate";
type PagesPreviewData = object | string;
type PagesPreviewState = {
  data: PagesPreviewData | false;
  shouldClear: boolean;
};
type PreviewResponse = {
  getHeader(name: string): string | number | boolean | string[] | undefined;
  setHeader(name: string, value: string | number | boolean | string[]): unknown;
};
declare function getPagesPreviewModeId(): string;
declare function getPagesPreviewState(cookieHeader: string | string[] | null | undefined, options?: {
  isOnDemandRevalidate?: boolean;
}): PagesPreviewState;
declare function setPagesDraftMode(response: PreviewResponse, enabled: boolean): void;
declare function setPagesPreviewData(response: PreviewResponse, data: PagesPreviewData, options?: {
  maxAge?: number;
  path?: string;
}): void;
declare function clearPagesPreviewData(response: PreviewResponse, options?: {
  path?: string;
}): void;
declare function appendPagesPreviewClearCookies(headers: Headers): void;
//#endregion
export { PAGES_PREVIEW_CACHE_CONTROL, PagesPreviewData, PagesPreviewState, appendPagesPreviewClearCookies, clearPagesPreviewData, getPagesPreviewModeId, getPagesPreviewState, setPagesDraftMode, setPagesPreviewData };