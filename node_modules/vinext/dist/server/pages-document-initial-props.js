import { withScriptNonce } from "../shims/script-nonce-context.js";
import Document from "../shims/document.js";
import { readStreamAsText } from "../utils/text-stream.js";
import React from "react";
//#region src/server/pages-document-initial-props.ts
/**
* Pages Router `_document.tsx` `getInitialProps` helper.
*
* Next.js's `pages/_document.tsx` may override
* `static async getInitialProps(ctx)` to inject extra props onto the
* Document element (the classic pattern is
* `await Document.getInitialProps(ctx)` + spread, see Next.js's
* `test/e2e/async-modules/pages/_document.jsx`). The SSR pipeline invokes
* that hook and then renders the Document with the resolved props:
*
*   <Document {...htmlProps} {...docProps} />
*
* Reference:
* https://github.com/vercel/next.js/blob/canary/packages/next/src/server/render.tsx
* (search for `loadDocumentInitialProps` and `documentElement`).
*
* `runDocumentRenderPage()` supplies `renderPage`, `defaultGetInitialProps`,
* and the request pathname/query/asPath fields needed by the common upstream
* pattern:
*
*   static async getInitialProps(ctx) {
*     const initialProps = await Document.getInitialProps(ctx)
*     return { ...initialProps, docValue }
*   }
*
* The standalone `loadUserDocumentInitialProps()` compatibility path supplies
* an empty default render result because it is only used after the body has
* already been produced. Request-only fields such as req/res remain outside
* that compatibility helper.
*
* Returns `null` when the user did not override the base shim (the static
* `getInitialProps` reference still points at the shim's stub) so callers
* skip the spread and render the bare Document element on the fast path.
*
* Errors from a user `getInitialProps` propagate to the caller. Next.js's
* `loadGetInitialProps` does not catch — a throw becomes a 500 — and vinext
* matches that contract so user bugs surface as the loud failures Next.js
* apps already debug against.
*/
const BASE_GET_INITIAL_PROPS = Document.getInitialProps;
async function loadUserDocumentInitialProps(DocumentComponent) {
	const getInitialProps = DocumentComponent.getInitialProps;
	if (typeof getInitialProps !== "function") return null;
	if (getInitialProps === BASE_GET_INITIAL_PROPS) return null;
	const result = await getInitialProps({ defaultGetInitialProps: async () => ({ html: "" }) });
	return result && typeof result === "object" ? result : null;
}
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
async function runDocumentRenderPage(input) {
	const DocCtor = input.DocumentComponent;
	if (!DocCtor || typeof DocCtor.getInitialProps !== "function") return { status: "skipped" };
	if (DocCtor.getInitialProps === BASE_GET_INITIAL_PROPS) return { status: "skipped" };
	if (!input.enhancePageElement) return { status: "skipped" };
	const enhancePageElement = input.enhancePageElement;
	const renderPage = async (opts = {}) => {
		const wrapped = withScriptNonce(enhancePageElement(typeof opts === "function" ? { enhanceComponent: opts } : opts), input.scriptNonce);
		return {
			html: await readStreamAsText(await input.renderToReadableStream(wrapped)),
			head: []
		};
	};
	const docInitialProps = await DocCtor.getInitialProps({
		renderPage,
		defaultGetInitialProps: async (ctx) => {
			const result = await ctx.renderPage({ enhanceApp: (App) => (props) => React.createElement(App, props) });
			return {
				html: result.html,
				head: result.head ?? [],
				styles: void 0
			};
		},
		...input.context
	});
	const { html: _html, head: rawHead, styles: _styles, ...docProps } = docInitialProps ?? {};
	const head = Array.isArray(rawHead) ? rawHead : [];
	if (!docInitialProps || typeof docInitialProps.html !== "string") throw new Error(`"${DocCtor.displayName ?? DocCtor.name ?? "Document"}.getInitialProps()" should resolve to an object with a "html" prop set with a valid html string`);
	let stylesHTML = "";
	if (docInitialProps.styles != null) stylesHTML = await input.renderStylesToString(React.createElement(React.Fragment, null, docInitialProps.styles));
	return {
		status: "rendered",
		bodyHtml: docInitialProps.html,
		stylesHTML,
		docProps,
		head
	};
}
//#endregion
export { loadUserDocumentInitialProps, runDocumentRenderPage };
