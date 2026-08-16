import React from "react";
import { jsx } from "react/jsx-runtime";
//#region src/shims/app.tsx
/**
* next/app shim
*
* Provides the AppProps type and a runtime default `App` class component
* for Pages Router fixtures that follow the canonical `_app.js` pattern:
*
*   import App from "next/app";
*   export default class MyApp extends App { ... }
*
* or call `App.getInitialProps(appContext)` from a custom getInitialProps.
*
* Ported from Next.js:
*   https://github.com/vercel/next.js/blob/canary/packages/next/src/pages/_app.tsx
*
* Behavioural parity notes:
* - `App.getInitialProps(appContext)` returns `{ pageProps }`, where
*   `pageProps` comes from the wrapped page's own `getInitialProps` (if
*   any). This matches Next.js's behaviour via `loadGetInitialProps`.
* - `render()` returns `<Component {...pageProps} />` — the default
*   behaviour Next.js documents for the built-in App.
* - `origGetInitialProps` is preserved alongside `getInitialProps` for
*   userland code that introspects the original implementation.
*
* Type signatures mirror Next.js's intentionally permissive `<P = any>`
* generics so that userland subclasses like `class MyApp extends App`
* type-check without forcing the caller to supply generic parameters.
*/
async function appGetInitialProps({ Component, ctx }) {
	let pageProps = {};
	if (typeof Component.getInitialProps === "function") {
		pageProps = await Component.getInitialProps(ctx);
		if (pageProps == null) pageProps = {};
	}
	return { pageProps };
}
var App = class extends React.Component {
	static origGetInitialProps = appGetInitialProps;
	static getInitialProps = appGetInitialProps;
	render() {
		const { Component, pageProps } = this.props;
		return /* @__PURE__ */ jsx(Component, { ...pageProps });
	}
};
//#endregion
export { App as default };
