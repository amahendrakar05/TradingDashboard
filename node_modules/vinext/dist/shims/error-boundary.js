"use client";
import { decodeRedirectError, isRedirectError } from "./navigation-errors.js";
import "./navigation-server.js";
import { useErrorBoundaryPathname, useErrorBoundaryRouter } from "./error-boundary-navigation.js";
import DefaultGlobalError from "./default-global-error.js";
import { handleAppNavigationFailure } from "../client/app-nav-failure-handler.js";
import { VINEXT_DEV_ERROR_RECOVERY_EVENT } from "../utils/dev-error-recovery-event.js";
import { isNavigationSignalError } from "../utils/navigation-signal.js";
import React from "react";
import { Fragment as Fragment$1, jsx, jsxs } from "react/jsx-runtime";
//#region src/shims/error-boundary.tsx
function SerializedErrorBoundary({ fallback: Fallback, error }) {
	return /* @__PURE__ */ jsx(Fallback, {
		error: Object.assign(new Error(error.message), {
			digest: error.digest,
			name: error.name ?? "Error",
			stack: error.stack
		}),
		reset: () => globalThis.location?.reload()
	});
}
function normalizeBoundaryResetKey(resetKey) {
	return resetKey === void 0 || resetKey === null || resetKey === "" ? null : resetKey;
}
function readBoundaryResetState(props) {
	return {
		previousPathname: props.pathname,
		previousResetKey: normalizeBoundaryResetKey(props.resetKey)
	};
}
function shouldResetBoundary(nextResetState, previousResetState) {
	const nextResetKey = normalizeBoundaryResetKey(nextResetState.previousResetKey);
	const previousResetKey = normalizeBoundaryResetKey(previousResetState.previousResetKey);
	if (nextResetKey !== null || previousResetKey !== null) return nextResetKey !== previousResetKey;
	return nextResetState.previousPathname !== previousResetState.previousPathname;
}
function addDevErrorRecoveryListener(listener) {
	if (typeof window === "undefined") return;
	window.addEventListener(VINEXT_DEV_ERROR_RECOVERY_EVENT, listener);
}
function removeDevErrorRecoveryListener(listener) {
	if (typeof window === "undefined") return;
	window.removeEventListener(VINEXT_DEV_ERROR_RECOVERY_EVENT, listener);
}
function HandleRedirect({ redirect, redirectType, reset }) {
	const router = useErrorBoundaryRouter();
	React.useEffect(() => {
		React.startTransition(() => {
			if (redirectType === "push") router.push(redirect);
			else router.replace(redirect);
			reset();
		});
	}, [
		redirect,
		redirectType,
		reset,
		router
	]);
	return null;
}
var RedirectErrorBoundary = class extends React.Component {
	constructor(props) {
		super(props);
		this.state = {
			redirect: null,
			redirectType: null
		};
	}
	static getDerivedStateFromError(error) {
		if (isRedirectError(error)) {
			if ("handled" in error && error.handled) return {
				redirect: null,
				redirectType: null
			};
			const result = decodeRedirectError(error.digest);
			if (!result) throw error;
			return {
				redirect: result.url,
				redirectType: result.type
			};
		}
		throw error;
	}
	render() {
		const { redirect, redirectType } = this.state;
		if (redirect !== null && redirectType !== null) return /* @__PURE__ */ jsx(HandleRedirect, {
			redirect,
			redirectType,
			reset: () => this.setState({
				redirect: null,
				redirectType: null
			})
		});
		return this.props.children;
	}
};
function RedirectBoundary({ children }) {
	return /* @__PURE__ */ jsx(RedirectErrorBoundary, { children });
}
/**
* Generic ErrorBoundary used to wrap route segments with error.tsx.
* This must be a client component since error boundaries use
* componentDidCatch / getDerivedStateFromError.
*/
var ErrorBoundaryInner = class extends React.Component {
	constructor(props) {
		super(props);
		this.state = {
			error: null,
			...readBoundaryResetState(props)
		};
	}
	static getDerivedStateFromProps(props, state) {
		const nextResetState = readBoundaryResetState(props);
		if (state.error && handleAppNavigationFailure(state.error.thrownValue)) return {
			error: null,
			...nextResetState
		};
		if (state.error && shouldResetBoundary(nextResetState, state)) return {
			error: null,
			...nextResetState
		};
		return {
			error: state.error,
			...nextResetState
		};
	}
	static getDerivedStateFromError(error) {
		if (isNavigationSignalError(error)) throw error;
		return { error: { thrownValue: error } };
	}
	handleDevErrorRecovery = () => {
		if (!this.state.error) return;
		this.setState({
			error: null,
			...readBoundaryResetState(this.props)
		});
	};
	componentDidMount() {
		addDevErrorRecoveryListener(this.handleDevErrorRecovery);
	}
	componentWillUnmount() {
		removeDevErrorRecoveryListener(this.handleDevErrorRecovery);
	}
	reset = () => {
		this.setState({ error: null });
	};
	render() {
		if (this.state.error) {
			const FallbackComponent = this.props.fallback;
			return /* @__PURE__ */ jsx(FallbackComponent, {
				error: this.state.error.thrownValue,
				reset: this.reset
			});
		}
		return this.props.children;
	}
};
function ErrorBoundary({ fallback, children, resetKey }) {
	return /* @__PURE__ */ jsx(ErrorBoundaryInner, {
		pathname: useErrorBoundaryPathname(),
		resetKey,
		fallback,
		children
	});
}
function GlobalErrorBoundary({ fallback, children }) {
	return /* @__PURE__ */ jsx(ErrorBoundaryInner, {
		pathname: useErrorBoundaryPathname(),
		fallback,
		isImplicitRootErrorBoundary: fallback === DefaultGlobalError,
		children
	});
}
/**
* Inner class component that catches notFound() errors and renders the
* not-found.tsx fallback. Resets on the caller's segment reset key when one is
* provided, otherwise falls back to pathname changes for legacy callers.
*
* The ErrorBoundary above re-throws notFound errors so they propagate up to this
* boundary. This must be placed above the ErrorBoundary in the component tree.
*/
var NotFoundBoundaryInner = class extends React.Component {
	constructor(props) {
		super(props);
		this.state = {
			notFound: false,
			...readBoundaryResetState(props)
		};
	}
	static getDerivedStateFromProps(props, state) {
		const nextResetState = readBoundaryResetState(props);
		if (state.notFound && shouldResetBoundary(nextResetState, state)) return {
			notFound: false,
			...nextResetState
		};
		return {
			notFound: state.notFound,
			...nextResetState
		};
	}
	static getDerivedStateFromError(error) {
		if (error && typeof error === "object" && "digest" in error) {
			const digest = String(error.digest);
			if (digest === "NEXT_NOT_FOUND" || digest === "NEXT_HTTP_ERROR_FALLBACK;404") return { notFound: true };
		}
		throw error;
	}
	render() {
		if (this.state.notFound) return /* @__PURE__ */ jsxs(Fragment$1, { children: [/* @__PURE__ */ jsx("meta", {
			name: "robots",
			content: "noindex"
		}), this.props.fallback] });
		return this.props.children;
	}
};
/**
* Wrapper that reads the current pathname and passes it to the inner class
* component. Segment reset keys own App Router remount semantics when present.
*/
function NotFoundBoundary({ fallback, children, resetKey }) {
	return /* @__PURE__ */ jsx(NotFoundBoundaryInner, {
		pathname: useErrorBoundaryPathname(),
		resetKey,
		fallback,
		children
	});
}
var ForbiddenBoundaryInner = class extends React.Component {
	constructor(props) {
		super(props);
		this.state = {
			forbidden: false,
			...readBoundaryResetState(props)
		};
	}
	static getDerivedStateFromProps(props, state) {
		const nextResetState = readBoundaryResetState(props);
		if (state.forbidden && shouldResetBoundary(nextResetState, state)) return {
			forbidden: false,
			...nextResetState
		};
		return {
			forbidden: state.forbidden,
			...nextResetState
		};
	}
	static getDerivedStateFromError(error) {
		if (error && typeof error === "object" && "digest" in error) {
			if (String(error.digest) === "NEXT_HTTP_ERROR_FALLBACK;403") return { forbidden: true };
		}
		throw error;
	}
	render() {
		if (this.state.forbidden) return /* @__PURE__ */ jsxs(Fragment$1, { children: [/* @__PURE__ */ jsx("meta", {
			name: "robots",
			content: "noindex"
		}), this.props.fallback] });
		return this.props.children;
	}
};
function ForbiddenBoundary({ fallback, children, resetKey }) {
	return /* @__PURE__ */ jsx(ForbiddenBoundaryInner, {
		pathname: useErrorBoundaryPathname(),
		resetKey,
		fallback,
		children
	});
}
var UnauthorizedBoundaryInner = class extends React.Component {
	constructor(props) {
		super(props);
		this.state = {
			unauthorized: false,
			...readBoundaryResetState(props)
		};
	}
	static getDerivedStateFromProps(props, state) {
		const nextResetState = readBoundaryResetState(props);
		if (state.unauthorized && shouldResetBoundary(nextResetState, state)) return {
			unauthorized: false,
			...nextResetState
		};
		return {
			unauthorized: state.unauthorized,
			...nextResetState
		};
	}
	static getDerivedStateFromError(error) {
		if (error && typeof error === "object" && "digest" in error) {
			if (String(error.digest) === "NEXT_HTTP_ERROR_FALLBACK;401") return { unauthorized: true };
		}
		throw error;
	}
	render() {
		if (this.state.unauthorized) return /* @__PURE__ */ jsxs(Fragment$1, { children: [/* @__PURE__ */ jsx("meta", {
			name: "robots",
			content: "noindex"
		}), this.props.fallback] });
		return this.props.children;
	}
};
function UnauthorizedBoundary({ fallback, children, resetKey }) {
	return /* @__PURE__ */ jsx(UnauthorizedBoundaryInner, {
		pathname: useErrorBoundaryPathname(),
		resetKey,
		fallback,
		children
	});
}
var DevRecoveryBoundary = class extends React.Component {
	constructor(props) {
		super(props);
		this.state = {
			error: null,
			previousResetKey: props.resetKey
		};
	}
	static getDerivedStateFromProps(props, state) {
		if (props.resetKey === state.previousResetKey) return null;
		return {
			error: null,
			previousResetKey: props.resetKey
		};
	}
	static getDerivedStateFromError(error) {
		if (isNavigationSignalError(error)) throw error;
		return { error: { thrownValue: error } };
	}
	handleDevErrorRecovery = () => {
		if (!this.state.error) return;
		this.setState({
			error: null,
			previousResetKey: this.props.resetKey
		});
	};
	componentDidMount() {
		addDevErrorRecoveryListener(this.handleDevErrorRecovery);
	}
	componentWillUnmount() {
		removeDevErrorRecoveryListener(this.handleDevErrorRecovery);
	}
	componentDidCatch() {
		this.props.onCatch?.(this.props.resetKey);
	}
	render() {
		if (this.state.error) return null;
		return this.props.children;
	}
};
//#endregion
export { DevRecoveryBoundary, ErrorBoundary, ErrorBoundaryInner, ForbiddenBoundary, ForbiddenBoundaryInner, GlobalErrorBoundary, NotFoundBoundary, RedirectBoundary, RedirectErrorBoundary, SerializedErrorBoundary, UnauthorizedBoundary, UnauthorizedBoundaryInner };
