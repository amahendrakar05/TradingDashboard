import { runWithFetchDedupe } from "../shims/fetch-cache.js";
import { resolveAppPageSegmentParams } from "./app-page-params.js";
import { VINEXT_RSC_CONTENT_TYPE, VINEXT_RSC_VARY_HEADER, applyRscCompatibilityIdHeader, applyRscDeploymentIdHeader } from "./app-rsc-cache-busting.js";
import { mergeMiddlewareResponseHeaders } from "./middleware-response-headers.js";
import { applyEdgeRuntimeHeader } from "./app-page-response.js";
//#region src/server/app-page-boundary.ts
function resolveAppPageHttpAccessBoundaryComponent(options) {
	return options.getDefaultExport(resolveAppPageHttpAccessBoundaryModule({
		rootForbiddenModule: options.rootForbiddenModule,
		rootNotFoundModule: options.rootNotFoundModule,
		rootUnauthorizedModule: options.rootUnauthorizedModule,
		routeForbiddenModule: options.routeForbiddenModule,
		routeNotFoundModule: options.routeNotFoundModule,
		routeUnauthorizedModule: options.routeUnauthorizedModule,
		statusCode: options.statusCode
	})) ?? null;
}
function resolveAppPageHttpAccessBoundaryModule(options) {
	let boundaryModule;
	if (options.statusCode === 403) boundaryModule = options.routeForbiddenModule ?? options.rootForbiddenModule;
	else if (options.statusCode === 401) boundaryModule = options.routeUnauthorizedModule ?? options.rootUnauthorizedModule;
	else boundaryModule = options.routeNotFoundModule ?? options.rootNotFoundModule;
	return boundaryModule ?? null;
}
function resolveAppPageParentHttpAccessBoundaryModule(options) {
	return resolveAppPageParentHttpAccessBoundary(options).module;
}
/**
* Like {@link resolveAppPageParentHttpAccessBoundaryModule}, but also returns
* the layout index that owns the resolved boundary so callers can slice the
* layouts array to skip rendering layouts below the boundary owner.
*
* `layoutIndex` is the per-layout index where the boundary lives, or `null` if
* the resolved boundary is the root module (which conceptually sits above all
* layouts when no layout-level boundary is present).
*
* Used by the page-error fast path to make `forbidden()` / `unauthorized()` /
* `notFound()` escalate past intermediate layouts that lack a boundary file,
* matching Next.js's `create-component-tree.tsx` behavior where the nearest
* ancestor boundary owns the fallback subtree.
*
* @see https://github.com/vercel/next.js/blob/canary/packages/next/src/server/app-render/create-component-tree.tsx
*/
function resolveAppPageParentHttpAccessBoundary(options) {
	let routeModules = options.routeNotFoundModules;
	let rootModule = options.rootNotFoundModule;
	if (options.statusCode === 403) {
		routeModules = options.routeForbiddenModules;
		rootModule = options.rootForbiddenModule;
	} else if (options.statusCode === 401) {
		routeModules = options.routeUnauthorizedModules;
		rootModule = options.rootUnauthorizedModule;
	}
	if (routeModules) for (let index = options.layoutIndex - 1; index >= 0; index--) {
		const module = routeModules[index];
		if (module) return {
			module,
			layoutIndex: index
		};
	}
	return {
		module: rootModule ?? null,
		layoutIndex: null
	};
}
function resolveAppPageErrorBoundary(options) {
	const pageErrorComponent = options.getDefaultExport(options.pageErrorModule);
	if (pageErrorComponent) return {
		component: pageErrorComponent,
		isGlobalError: false
	};
	const segmentErrorModules = options.errorModules ?? options.layoutErrorModules;
	if (segmentErrorModules) for (let index = segmentErrorModules.length - 1; index >= 0; index--) {
		const segmentErrorComponent = options.getDefaultExport(segmentErrorModules[index]);
		if (segmentErrorComponent) return {
			component: segmentErrorComponent,
			isGlobalError: false
		};
	}
	const globalErrorComponent = options.getDefaultExport(options.globalErrorModule);
	return {
		component: globalErrorComponent ?? null,
		isGlobalError: Boolean(globalErrorComponent)
	};
}
function wrapAppPageBoundaryElement(options) {
	let element = options.element;
	if (!options.skipLayoutWrapping) for (let index = options.layoutModules.length - 1; index >= 0; index--) {
		const layoutComponent = options.getDefaultExport(options.layoutModules[index]);
		if (!layoutComponent) continue;
		const treePosition = options.layoutTreePositions ? options.layoutTreePositions[index] : 0;
		const asyncParams = options.makeThenableParams(resolveAppPageSegmentParams(options.routeSegments, treePosition, options.matchedParams));
		element = options.renderLayout(layoutComponent, element, asyncParams);
		if (options.isRscRequest && options.renderLayoutSegmentProvider && options.resolveChildSegments) {
			const childSegments = options.resolveChildSegments(options.routeSegments ?? [], treePosition, options.matchedParams);
			element = options.renderLayoutSegmentProvider({ children: childSegments }, element);
		}
	}
	if (options.isRscRequest && options.includeGlobalErrorBoundary && options.globalErrorComponent) element = options.renderErrorBoundary(options.globalErrorComponent, element);
	return element;
}
async function renderAppPageBoundaryResponse(options) {
	const rscStream = runWithFetchDedupe(() => options.renderToReadableStream(options.element, { onError: options.createRscOnErrorHandler() }));
	if (options.isRscRequest) {
		const headers = new Headers({
			"Content-Type": VINEXT_RSC_CONTENT_TYPE,
			Vary: VINEXT_RSC_VARY_HEADER
		});
		applyEdgeRuntimeHeader(headers, options.isEdgeRuntime);
		mergeMiddlewareResponseHeaders(headers, options.middlewareHeaders ?? null);
		applyRscCompatibilityIdHeader(headers);
		applyRscDeploymentIdHeader(headers);
		return new Response(rscStream, {
			status: options.status,
			headers
		});
	}
	return options.createHtmlResponse(rscStream, options.status);
}
//#endregion
export { renderAppPageBoundaryResponse, resolveAppPageErrorBoundary, resolveAppPageHttpAccessBoundaryComponent, resolveAppPageHttpAccessBoundaryModule, resolveAppPageParentHttpAccessBoundary, resolveAppPageParentHttpAccessBoundaryModule, wrapAppPageBoundaryElement };
