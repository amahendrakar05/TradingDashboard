import { stripBasePath } from "../utils/base-path.js";
import { markPprFallbackShellDynamicBoundary } from "./ppr-fallback-shell.js";
import { AppRouterContext } from "./internal/app-router-context.js";
import { getNavigationContext } from "./navigation-context-state.js";
import "./navigation-server.js";
import * as React$1 from "react";
//#region src/shims/error-boundary-navigation.ts
const CLIENT_NAVIGATION_STATE_KEY = Symbol.for("vinext.clientNavigationState");
const CLIENT_NAVIGATION_RENDER_CONTEXT_KEY = Symbol.for("vinext.clientNavigationRenderContext");
const BASE_PATH = process.env.__NEXT_ROUTER_BASEPATH ?? "";
function getClientNavigationState() {
	return globalThis[CLIENT_NAVIGATION_STATE_KEY];
}
function getClientPathnameSnapshot() {
	return getClientNavigationState()?.cachedPathname ?? stripBasePath(window.location.pathname, BASE_PATH);
}
function getServerPathnameSnapshot() {
	return getNavigationContext()?.pathname ?? "/";
}
function subscribeToCommittedPathname(listener) {
	const state = getClientNavigationState();
	if (!state) return () => {};
	state.listeners.add(listener);
	return () => state.listeners.delete(listener);
}
function getClientNavigationRenderContext() {
	const globalState = globalThis;
	return globalState[CLIENT_NAVIGATION_RENDER_CONTEXT_KEY] ??= React$1.createContext(null);
}
function useErrorBoundaryPathname() {
	if (typeof window === "undefined") markPprFallbackShellDynamicBoundary();
	const renderSnapshot = React$1.useContext(getClientNavigationRenderContext());
	const committedPathname = React$1.useSyncExternalStore(subscribeToCommittedPathname, getClientPathnameSnapshot, getServerPathnameSnapshot);
	if (renderSnapshot && (getClientNavigationState()?.navigationSnapshotActiveCount ?? 0) > 0) return renderSnapshot.pathname;
	return committedPathname;
}
function useErrorBoundaryRouter() {
	if (!AppRouterContext || typeof React$1.useContext !== "function") throw new Error("invariant expected app router to be mounted");
	const router = React$1.useContext(AppRouterContext);
	if (router === null) throw new Error("invariant expected app router to be mounted");
	return router;
}
//#endregion
export { useErrorBoundaryPathname, useErrorBoundaryRouter };
