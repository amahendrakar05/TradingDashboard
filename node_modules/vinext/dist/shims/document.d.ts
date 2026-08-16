import React from "react";
import { DocumentContext, DocumentInitialProps, DocumentProps } from "@vinext/types/next/upstream/dist/shared/lib/utils";
import { HtmlProps } from "@vinext/types/next/upstream/dist/shared/lib/html-context.shared-runtime";

//#region src/shims/document.d.ts
type OriginProps = {
  nonce?: string;
  crossOrigin?: "anonymous" | "use-credentials" | "" | undefined;
  children?: React.ReactNode;
};
type DocumentFiles = {
  sharedFiles: readonly string[];
  pageFiles: readonly string[];
  allFiles: readonly string[];
};
type HeadProps = OriginProps & React.ComponentPropsWithoutRef<"head">;
declare function Html(props: React.DetailedHTMLProps<React.HtmlHTMLAttributes<HTMLHtmlElement>, HTMLHtmlElement>): React.ReactElement;
interface Head {
  context: HtmlProps;
}
declare class Head extends React.Component<HeadProps> {
  static contextType: React.Context<HtmlProps | undefined>;
  getCssLinks(_files: DocumentFiles): React.ReactElement[] | null;
  getPreloadDynamicChunks(): Array<React.ReactElement | null>;
  getPreloadMainLinks(_files: DocumentFiles): React.ReactElement[] | null;
  getBeforeInteractiveInlineScripts(): React.ReactElement[];
  getDynamicChunks(_files: DocumentFiles): Array<React.ReactElement | null>;
  getPreNextScripts(): React.ReactElement;
  getScripts(_files: DocumentFiles): React.ReactElement[];
  getPolyfillScripts(): React.ReactElement[];
  render(): React.ReactElement;
}
declare function Main(): React.ReactElement;
interface NextScript {
  context: HtmlProps;
}
declare class NextScript extends React.Component<OriginProps> {
  static contextType: React.Context<HtmlProps | undefined>;
  getDynamicChunks(_files: DocumentFiles): Array<React.ReactElement | null>;
  getPreNextScripts(): React.ReactElement;
  getScripts(_files: DocumentFiles): React.ReactElement[];
  getPolyfillScripts(): React.ReactElement[];
  static getInlineScriptSource(context: Readonly<HtmlProps>): string;
  render(): React.ReactElement;
}
declare class Document<P = {}> extends React.Component<DocumentProps & P> {
  static getInitialProps(ctx: DocumentContext): Promise<DocumentInitialProps>;
  render(): React.ReactElement;
}
//#endregion
export { type DocumentContext, type DocumentInitialProps, type DocumentProps, Head, Html, Main, NextScript, OriginProps, Document as default };