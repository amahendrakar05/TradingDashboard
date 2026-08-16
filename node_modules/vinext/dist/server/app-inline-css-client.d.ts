//#region src/server/app-inline-css-client.d.ts
type InlineCssStylesheetLinkElement = Pick<HTMLLinkElement, "getAttribute" | "hasAttribute">;
declare function isInlineCssStylesheetLinkElement(link: InlineCssStylesheetLinkElement): boolean;
declare function removeStylesheetLinksCoveredByInlineCss(): void;
//#endregion
export { isInlineCssStylesheetLinkElement, removeStylesheetLinksCoveredByInlineCss };