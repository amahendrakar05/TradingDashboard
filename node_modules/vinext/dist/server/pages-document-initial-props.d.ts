import React, { ComponentType, ReactNode } from "react";

//#region src/server/pages-document-initial-props.d.ts
declare function loadUserDocumentInitialProps(DocumentComponent: ComponentType): Promise<Record<string, unknown> | null>;
/** Options accepted by a `ctx.renderPage()` call (Pages Router contract). */
type RenderPageEnhancers = {
  enhanceApp?: (App: ComponentType<{
    children?: ReactNode;
  }>) => any;
  enhanceComponent?: (Comp: ComponentType<unknown>) => any;
};
type DocumentRenderPageInput = {
  /** The user `_document` component (may define `getInitialProps`). */DocumentComponent: ComponentType | null;
  /**
   * Build the page React tree with optional App/Component enhancers applied.
   * Callers MUST NOT apply `withScriptNonce` themselves — this helper owns the
   * nonce responsibility so the prod and dev paths stay symmetric.
   */
  enhancePageElement?: ((opts: RenderPageEnhancers) => ReactNode) | undefined; /** Render a React tree to a UTF-8 byte stream (prod/dev specific). */
  renderToReadableStream: (element: React.ReactElement) => Promise<ReadableStream<Uint8Array>>; /** Render the document `styles` element to an HTML string. */
  renderStylesToString: (element: React.ReactElement) => Promise<string>; /** Per-request CSP nonce applied to the enhanced page tree, if any. */
  scriptNonce?: string | undefined; /** Extra `DocumentContext` fields (pathname/query/asPath). */
  context?: Record<string, unknown> | undefined;
};
/**
 * Run a user `_document.getInitialProps()` with a `ctx.renderPage()` that
 * applies optional `enhanceApp` / `enhanceComponent` wrappers around the page
 * React tree, mirroring Next.js's Pages Router contract.
 *
 * Used by CSS-in-JS libraries (styled-components, emotion) to wrap the
 * App/Component tree so styles can be collected during SSR. Shared between the
 * prod (`pages-page-response.ts`) and dev (`dev-server.ts`) SSR pipelines so
 * the `getInitialProps` + `renderPage` contract lives in one place.
 *
 * @see .nextjs-ref/packages/next/src/server/render.tsx (search `renderPage`)
 *
 * Result of attempting the renderPage contract:
 *   - `skipped`  — `getInitialProps` was NOT invoked (no override, or no
 *                  `enhancePageElement` wired up). Callers should run the
 *                  normal `loadUserDocumentInitialProps` fast path, which may
 *                  invoke `getInitialProps` itself.
 *   - `rendered` — `renderPage` produced the body. `bodyHtml` is the rendered
 *                  page string, `stylesHTML` the rendered `styles`, `docProps`
 *                  the remaining props to spread onto `<Document>`, and `head`
 *                  the head nodes returned by `getInitialProps` (forward them to
 *                  `setDocumentInitialHead()` — do NOT call
 *                  `callDocumentGetInitialProps()` as well).
 */
type RunDocumentRenderPageResult = {
  status: "skipped";
} | {
  status: "rendered";
  bodyHtml: string;
  stylesHTML: string;
  docProps: Record<string, unknown>;
  head: ReactNode[];
};
/**
 * Run a user `_document.getInitialProps()` with a `ctx.renderPage()` that
 * applies optional `enhanceApp` / `enhanceComponent` wrappers around the page
 * React tree, mirroring Next.js's Pages Router contract.
 *
 * Used by CSS-in-JS libraries (styled-components, emotion) to wrap the
 * App/Component tree so styles can be collected during SSR. Shared between the
 * prod (`pages-page-response.ts`) and dev (`dev-server.ts`) SSR pipelines so
 * the `getInitialProps` + `renderPage` contract lives in one place.
 *
 * `getInitialProps` is invoked at most once here. When this returns `rendered`,
 * callers MUST treat that as the single invocation and must not call
 * `loadUserDocumentInitialProps` again. Errors intentionally propagate to the
 * Pages Router's normal error-page pipeline, matching Next.js.
 *
 * @see .nextjs-ref/packages/next/src/server/render.tsx (search `renderPage`)
 */
declare function runDocumentRenderPage(input: DocumentRenderPageInput): Promise<RunDocumentRenderPageResult>;
//#endregion
export { RenderPageEnhancers, loadUserDocumentInitialProps, runDocumentRenderPage };