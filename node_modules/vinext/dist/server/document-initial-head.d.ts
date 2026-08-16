import React from "react";

//#region src/server/document-initial-head.d.ts
declare function callDocumentGetInitialProps(DocumentComponent: React.ComponentType | null | undefined, setDocumentInitialHead: ((head: React.ReactNode[]) => void) | undefined): Promise<void>;
//#endregion
export { callDocumentGetInitialProps };