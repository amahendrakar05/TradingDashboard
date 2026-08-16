import Document from "../shims/document.js";
//#region src/server/document-initial-head.ts
/**
* Reference to the unmodified `Document.getInitialProps` static. Used to
* detect when a user `_document.tsx` did NOT override the method (i.e. they
* extend `Document` but only redefine `render`), so we can skip the call.
*
* Captured via an indexed access (`Document["getInitialProps"]`) rather than
* a dotted access so oxlint's `unbound-method` rule doesn't flag this as a
* possible `this` escape — `getInitialProps` is a static method with no
* `this` dependency, so capturing the function reference is safe.
*/
const DEFAULT_GET_INITIAL_PROPS = Document["getInitialProps"];
async function callDocumentGetInitialProps(DocumentComponent, setDocumentInitialHead) {
	if (!DocumentComponent || !setDocumentInitialHead) return;
	const getInitialProps = DocumentComponent.getInitialProps;
	if (typeof getInitialProps !== "function" || getInitialProps === DEFAULT_GET_INITIAL_PROPS) return;
	try {
		const initialProps = await getInitialProps({
			defaultGetInitialProps: async () => ({
				html: "",
				head: [],
				styles: void 0
			}),
			renderPage: () => ({ html: "" })
		});
		setDocumentInitialHead(Array.isArray(initialProps?.head) ? initialProps.head : []);
	} catch (err) {
		console.error("[vinext] _document.getInitialProps() threw:", err);
	}
}
//#endregion
export { callDocumentGetInitialProps };
