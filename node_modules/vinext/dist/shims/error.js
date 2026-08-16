import { AppRouterContext } from "./internal/app-router-context.js";
import { RouterContext } from "./internal/router-context.js";
import Head from "./head.js";
import { isNextRouterError } from "./navigation-errors.js";
import "./navigation.js";
import { useUntrackedPathname } from "./internal/navigation-untracked.js";
import React from "react";
//#region src/shims/error.tsx
/**
* next/error shim
*
* Provides the default Next.js error page component.
* Used by apps that import `import Error from 'next/error'` for
* custom error handling in getServerSideProps or API routes.
*
* Also re-exports the unstable App Router error-boundary HOC
* (`unstable_catchError`) and its `ErrorInfo` type, mirroring
* `next/error`'s public surface.
*/
const statusCodes = {
	400: "Bad Request",
	404: "This page could not be found",
	405: "Method Not Allowed",
	500: "Internal Server Error"
};
function getErrorInitialProps({ err, req, res }) {
	const statusCode = res?.statusCode ? res.statusCode : err ? err.statusCode : 404;
	let hostname;
	if (typeof window !== "undefined") hostname = window.location.hostname;
	else if (req) {
		if (req.url) try {
			hostname = new URL(req.url).hostname;
		} catch {}
		if (!hostname) {
			const host = Array.isArray(req.headers?.host) ? req.headers.host[0] : req.headers?.host;
			if (host) hostname = new URL(`http://${host}`).hostname;
		}
	}
	return {
		statusCode,
		hostname
	};
}
const styles = {
	error: {
		fontFamily: "system-ui,\"Segoe UI\",Roboto,Helvetica,Arial,sans-serif,\"Apple Color Emoji\",\"Segoe UI Emoji\"",
		height: "100vh",
		textAlign: "center",
		display: "flex",
		flexDirection: "column",
		alignItems: "center",
		justifyContent: "center"
	},
	desc: { lineHeight: "48px" },
	h1: {
		display: "inline-block",
		margin: "0 20px 0 0",
		paddingRight: 23,
		fontSize: 24,
		fontWeight: 500,
		verticalAlign: "top"
	},
	h2: {
		fontSize: 14,
		fontWeight: 400,
		lineHeight: "28px"
	},
	wrap: { display: "inline-block" }
};
var ErrorComponent = class extends React.Component {
	static displayName = "ErrorPage";
	static getInitialProps = getErrorInitialProps;
	static origGetInitialProps = getErrorInitialProps;
	render() {
		const { statusCode, hostname, title: customTitle, withDarkMode = true } = this.props;
		const title = customTitle || statusCodes[statusCode] || "An unexpected error has occurred";
		return React.createElement("div", { style: styles.error }, React.createElement(Head, null, React.createElement("title", null, statusCode ? `${statusCode}: ${title}` : "Application error: a client-side exception has occurred")), React.createElement("div", { style: styles.desc }, React.createElement("style", { dangerouslySetInnerHTML: { __html: `body{color:#000;background:#fff;margin:0}.next-error-h1{border-right:1px solid rgba(0,0,0,.3)}${withDarkMode ? "@media (prefers-color-scheme:dark){body{color:#fff;background:#000}.next-error-h1{border-right:1px solid rgba(255,255,255,.3)}}" : ""}` } }), statusCode ? React.createElement("h1", {
			className: "next-error-h1",
			style: styles.h1
		}, statusCode) : null, React.createElement("div", { style: styles.wrap }, React.createElement("h2", { style: styles.h2 }, customTitle || statusCode ? `${title}.` : `Application error: a client-side exception has occurred${hostname ? ` while loading ${hostname}` : ""} (see the browser console for more information).`))));
	}
};
const _CatchErrorAppRouterContext = AppRouterContext ?? React.createContext(null);
var _CatchError = class extends React.Component {
	static contextType = _CatchErrorAppRouterContext;
	static displayName = "unstable_catchError(Next.CatchError)";
	constructor(props) {
		super(props);
		this.state = {
			error: null,
			previousPathname: props.pathname
		};
	}
	static getDerivedStateFromError(thrownValue) {
		if (isNextRouterError(thrownValue)) throw thrownValue;
		return { error: { thrownValue } };
	}
	static getDerivedStateFromProps(props, state) {
		if (props.pathname !== state.previousPathname && state.error) return {
			error: null,
			previousPathname: props.pathname
		};
		return {
			error: state.error,
			previousPathname: props.pathname
		};
	}
	reset = () => {
		this.setState({ error: null });
	};
	unstable_retry = () => {
		if (this.props.isPagesRouter) throw new Error("`unstable_retry()` can only be used in the App Router. Use `reset()` in the Pages Router.");
		React.startTransition(() => {
			this.context?.refresh();
			this.reset();
		});
	};
	render() {
		if (this.state.error) {
			const Fallback = this.props.fallback;
			const errorInfo = {
				error: this.state.error.thrownValue instanceof Error ? this.state.error.thrownValue : new Error(String(this.state.error.thrownValue)),
				reset: this.reset,
				unstable_retry: this.unstable_retry
			};
			return React.createElement(Fallback, {
				props: this.props.props,
				errorInfo
			});
		}
		return this.props.children;
	}
};
/**
* Wrap a fallback render function in a Component-level error boundary.
* Returns a Component that renders `children` and, on error, renders the
* supplied fallback with an `ErrorInfo` value.
*
* Ported from Next.js:
*   https://github.com/vercel/next.js/blob/canary/packages/next/src/client/components/catch-error.tsx
*/
function unstable_catchError(fallback) {
	const Fallback = ({ props, errorInfo }) => fallback(props, errorInfo);
	Fallback.displayName = fallback.name || "CatchErrorFallback";
	function CatchErrorBoundary(allProps) {
		const { children, ...rest } = allProps;
		const pathname = useUntrackedPathname();
		const isPagesRouter = React.useContext(RouterContext) !== null;
		const forwardedProps = rest;
		return React.createElement(_CatchError, {
			fallback: Fallback,
			isPagesRouter,
			pathname,
			props: forwardedProps
		}, children);
	}
	CatchErrorBoundary.displayName = `unstable_catchError(${fallback.name || "CatchErrorFallback"})`;
	return CatchErrorBoundary;
}
//#endregion
export { ErrorComponent as default, unstable_catchError };
