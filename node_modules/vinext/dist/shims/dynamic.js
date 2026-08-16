import { DynamicPreloadChunks } from "./dynamic-preload-chunks.js";
import React from "react";
//#region src/shims/dynamic.ts
/**
* next/dynamic shim
*
* SSR-safe dynamic imports. On the server, uses React.lazy + Suspense so that
* renderToReadableStream suspends until the dynamically-imported component is
* available. On the client, also uses React.lazy for code splitting.
*
* Works in RSC, SSR, and client environments:
* - RSC: Uses React.lazy + Suspense (available in React 19.x react-server).
*   Falls back to async component pattern if a future React version
*   strips lazy from react-server.
* - SSR: React.lazy + Suspense (renderToReadableStream suspends)
* - Client: React.lazy + Suspense (standard code splitting)
*
* Supports:
* - dynamic(import('./Component'))
* - dynamic(() => import('./Component'))
* - dynamic({ loader })
* - dynamic(() => import('./Component'), { loading: () => <Spinner /> })
* - dynamic(() => import('./Component'), { ssr: false })
*/
const noopRetry = () => {};
function createDynamicLoadingProps(overrides = {}) {
	return {
		error: null,
		isLoading: true,
		pastDelay: true,
		retry: noopRetry,
		timedOut: false,
		...overrides
	};
}
function hasDefaultExport(mod) {
	return (typeof mod === "object" || typeof mod === "function") && mod !== null && "default" in mod;
}
function normalizeLoader(loader) {
	if (typeof loader === "function") return loader;
	return () => loader;
}
function normalizeDynamicOptions(dynamicInput, options) {
	let normalizedOptions;
	if (dynamicInput instanceof Promise || typeof dynamicInput === "function") normalizedOptions = { loader: normalizeLoader(dynamicInput) };
	else normalizedOptions = dynamicInput;
	return {
		...normalizedOptions,
		...options
	};
}
function createLazyComponent(loader) {
	return React.lazy(async () => {
		const mod = await loader();
		if (hasDefaultExport(mod)) return mod;
		return { default: mod };
	});
}
function useRetryableLazyComponent(loader, initialLazyComponent) {
	const [LazyComponent, setLazyComponent] = React.useState(() => initialLazyComponent);
	const [retryKey, setRetryKey] = React.useState(0);
	return {
		LazyComponent,
		retry: React.useCallback(() => {
			setLazyComponent(() => createLazyComponent(loader));
			setRetryKey((key) => key + 1);
		}, [loader]),
		retryKey
	};
}
function createElementWithProps(Component, props) {
	return React.createElement(Component, props);
}
/**
* Lightweight error boundary that renders the loading component with the error
* when a dynamic() loader rejects. Without this, loader failures would propagate
* uncaught through React's rendering — this preserves the Next.js behavior where
* the `loading` component can display errors.
*
* Lazily created because React.Component is not available in the RSC environment
* (server components use a slimmed-down React that doesn't include class components).
*/
let DynamicErrorBoundary;
function getDynamicErrorBoundary() {
	if (DynamicErrorBoundary) return DynamicErrorBoundary;
	if (!React.Component) return null;
	DynamicErrorBoundary = class extends React.Component {
		constructor(props) {
			super(props);
			this.state = {
				error: null,
				resetKey: props.resetKey
			};
		}
		static getDerivedStateFromProps(props, state) {
			if (props.resetKey !== state.resetKey) return {
				error: null,
				resetKey: props.resetKey
			};
			return null;
		}
		static getDerivedStateFromError(error) {
			return { error: error instanceof Error ? error : new Error(String(error)) };
		}
		render() {
			if (this.state.error) return React.createElement(this.props.fallback, createDynamicLoadingProps({
				isLoading: false,
				error: this.state.error,
				retry: this.props.retry
			}));
			return this.props.children;
		}
	};
	return DynamicErrorBoundary;
}
const isServer = typeof window === "undefined";
const preloadQueue = [];
/**
* Wait for all pending dynamic() preloads to resolve, then clear the queue.
* Called by the Pages Router SSR handler before rendering.
* No-op for the App Router path which uses React.lazy + Suspense.
*/
function flushPreloads() {
	const pending = preloadQueue.splice(0);
	return Promise.all(pending);
}
function dynamic(dynamicInput, options) {
	const normalizedOptions = normalizeDynamicOptions(dynamicInput, options);
	const { loader: dynamicLoader, loadableGenerated, loading: LoadingComponent, ssr = true } = normalizedOptions;
	if (dynamicLoader && typeof dynamicLoader === "object" && !(dynamicLoader instanceof Promise)) throw new Error("next/dynamic loader maps are not supported by vinext");
	const loader = dynamicLoader ? normalizeLoader(dynamicLoader) : () => Promise.resolve(() => null);
	const generatedModules = loadableGenerated?.modules;
	const optionModules = normalizedOptions.modules;
	const configuredModules = generatedModules ?? optionModules;
	const preloadModuleIds = typeof configuredModules === "function" ? Object.keys(configuredModules()) : configuredModules;
	if (!ssr) {
		if (isServer) {
			const SSRFalse = (_props) => LoadingComponent ? React.createElement(LoadingComponent, createDynamicLoadingProps()) : null;
			SSRFalse.displayName = "DynamicSSRFalse";
			return SSRFalse;
		}
		const InitialLazyComponent = createLazyComponent(loader);
		const ClientSSRFalse = (props) => {
			const [mounted, setMounted] = React.useState(false);
			const { LazyComponent, retry, retryKey } = useRetryableLazyComponent(loader, InitialLazyComponent);
			React.useEffect(() => setMounted(true), []);
			if (!mounted) return LoadingComponent ? React.createElement(LoadingComponent, createDynamicLoadingProps({ retry })) : null;
			const fallback = LoadingComponent ? React.createElement(LoadingComponent, createDynamicLoadingProps({ retry })) : null;
			const lazyElement = createElementWithProps(LazyComponent, props);
			let content = lazyElement;
			if (LoadingComponent) {
				const ErrorBoundary = getDynamicErrorBoundary();
				if (ErrorBoundary) content = React.createElement(ErrorBoundary, {
					fallback: LoadingComponent,
					retry,
					resetKey: retryKey
				}, lazyElement);
			}
			return React.createElement(React.Suspense, { fallback }, content);
		};
		ClientSSRFalse.displayName = "DynamicClientSSRFalse";
		return ClientSSRFalse;
	}
	if (isServer) {
		if (typeof React.lazy !== "function") {
			const AsyncServerDynamic = async (props) => {
				const mod = await loader();
				return createElementWithProps("default" in mod ? mod.default : mod, props);
			};
			AsyncServerDynamic.displayName = "DynamicAsyncServer";
			return AsyncServerDynamic;
		}
		const LazyServer = createLazyComponent(loader);
		const ServerDynamic = (props) => {
			const fallback = LoadingComponent ? React.createElement(LoadingComponent, createDynamicLoadingProps()) : null;
			const lazyElement = createElementWithProps(LazyServer, props);
			let content = lazyElement;
			if (LoadingComponent) {
				const ErrorBoundary = getDynamicErrorBoundary();
				if (ErrorBoundary) content = React.createElement(ErrorBoundary, {
					fallback: LoadingComponent,
					retry: noopRetry,
					resetKey: 0
				}, lazyElement);
			}
			return React.createElement(React.Fragment, null, React.createElement(DynamicPreloadChunks, { moduleIds: preloadModuleIds }), React.createElement(React.Suspense, { fallback }, content));
		};
		ServerDynamic.displayName = "DynamicServer";
		return ServerDynamic;
	}
	const InitialLazyComponent = createLazyComponent(loader);
	const ClientDynamic = (props) => {
		const { LazyComponent, retry, retryKey } = useRetryableLazyComponent(loader, InitialLazyComponent);
		const fallback = LoadingComponent ? React.createElement(LoadingComponent, createDynamicLoadingProps({ retry })) : null;
		const lazyElement = createElementWithProps(LazyComponent, props);
		let content = lazyElement;
		if (LoadingComponent) {
			const ErrorBoundary = getDynamicErrorBoundary();
			if (ErrorBoundary) content = React.createElement(ErrorBoundary, {
				fallback: LoadingComponent,
				retry,
				resetKey: retryKey
			}, lazyElement);
		}
		return React.createElement(React.Suspense, { fallback }, content);
	};
	ClientDynamic.displayName = "DynamicClient";
	return ClientDynamic;
}
function noSSR(LoadableInitializer, loadableOptions) {
	delete loadableOptions.webpack;
	delete loadableOptions.modules;
	if (!isServer) return LoadableInitializer(loadableOptions);
	const Loading = loadableOptions.loading;
	const NoSSR = () => React.createElement(Loading, {
		error: null,
		isLoading: true,
		pastDelay: false,
		timedOut: false
	});
	NoSSR.displayName = "NoSSR";
	return NoSSR;
}
//#endregion
export { dynamic as default, flushPreloads, noSSR };
