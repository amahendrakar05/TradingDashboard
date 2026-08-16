import React from "react";
import { Fragment as Fragment$1, jsx, jsxs } from "react/jsx-runtime";
//#region src/shims/document.tsx
/**
* next/document shim
*
* Provides Html, Head, Main, NextScript, and the class-based Document API for
* custom Pages Router documents. Vinext's renderer replaces the Main and
* NextScript placeholders with the rendered page and hydration scripts.
*/
const HtmlContext = React.createContext(void 0);
function Html(props) {
	return /* @__PURE__ */ jsx("html", { ...props });
}
var Head = class extends React.Component {
	static contextType = HtmlContext;
	getCssLinks(_files) {
		return null;
	}
	getPreloadDynamicChunks() {
		return [];
	}
	getPreloadMainLinks(_files) {
		return null;
	}
	getBeforeInteractiveInlineScripts() {
		return [];
	}
	getDynamicChunks(_files) {
		return [];
	}
	getPreNextScripts() {
		return /* @__PURE__ */ jsx(Fragment$1, {});
	}
	getScripts(_files) {
		return [];
	}
	getPolyfillScripts() {
		return [];
	}
	render() {
		const { children, ...props } = this.props;
		return /* @__PURE__ */ jsx("head", {
			...props,
			children
		});
	}
};
function Main() {
	return /* @__PURE__ */ jsx("div", {
		id: "__next",
		dangerouslySetInnerHTML: { __html: "__NEXT_MAIN__" }
	});
}
var NextScript = class extends React.Component {
	static contextType = HtmlContext;
	getDynamicChunks(_files) {
		return [];
	}
	getPreNextScripts() {
		return /* @__PURE__ */ jsx(Fragment$1, {});
	}
	getScripts(_files) {
		return [];
	}
	getPolyfillScripts() {
		return [];
	}
	static getInlineScriptSource(context) {
		return JSON.stringify(context.__NEXT_DATA__);
	}
	render() {
		return /* @__PURE__ */ jsx("span", { dangerouslySetInnerHTML: { __html: "<!-- __NEXT_SCRIPTS__ -->" } });
	}
};
var Document = class extends React.Component {
	static getInitialProps(ctx) {
		return ctx.defaultGetInitialProps(ctx);
	}
	render() {
		return /* @__PURE__ */ jsxs(Html, { children: [/* @__PURE__ */ jsx(Head, {}), /* @__PURE__ */ jsxs("body", { children: [/* @__PURE__ */ jsx(Main, {}), /* @__PURE__ */ jsx(NextScript, {})] })] });
	}
};
//#endregion
export { Head, Html, Main, NextScript, Document as default };
