import React from "react";

//#region src/shims/default-not-found.d.ts
/**
 * Mirrors `<HTTPAccessErrorFallback status={404} message="This page could not be found." />`
 * from Next.js. Kept in sync with the upstream component's structure so HTML
 * snapshot diffs between Next.js and vinext stay minimal.
 */
declare function DefaultNotFound(): React.ReactElement;
//#endregion
export { DefaultNotFound as default };