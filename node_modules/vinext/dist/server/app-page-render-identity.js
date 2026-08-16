import { normalizePathnameForRouteMatch } from "../routing/utils.js";
import { isInterceptionMatchedUrlPath, normalizePath } from "./normalize-path.js";
import { AppElementsWire } from "./app-elements-wire.js";
import "./app-elements.js";
//#region src/server/app-page-render-identity.ts
function normalizeAppPageRenderMatchedPathname(pathname) {
	if (!pathname.startsWith("/")) throw new Error(`[vinext] App Router render pathname must be absolute: ${pathname}`);
	return normalizePath(normalizePathnameForRouteMatch(pathname));
}
function normalizeAppPageInterceptionProofPathname(pathname) {
	if (pathname === null || !isInterceptionMatchedUrlPath(pathname)) return null;
	return normalizeAppPageRenderMatchedPathname(pathname);
}
function createAppPageRenderIdentity(input) {
	const interceptionContext = input.interceptionContext ?? null;
	const targetMatchedPathname = normalizeAppPageRenderMatchedPathname(input.targetMatchedPathname ?? input.displayPathname);
	const requestedMatchedRoutePathname = normalizeAppPageRenderMatchedPathname(input.matchedRoutePathname ?? input.targetMatchedPathname ?? input.displayPathname);
	const sourceMatchedPathname = normalizeAppPageInterceptionProofPathname(input.interceptSourceMatchedUrl ?? null);
	const slotId = input.interceptSlotId ?? null;
	const matchedRoutePathname = sourceMatchedPathname ?? requestedMatchedRoutePathname;
	const routeId = AppElementsWire.encodeRouteId(matchedRoutePathname, null);
	const pageId = AppElementsWire.encodePageId(matchedRoutePathname, null);
	const interception = sourceMatchedPathname === null || slotId === null ? null : {
		sourceMatchedUrl: sourceMatchedPathname,
		sourceRouteId: AppElementsWire.encodeRouteId(sourceMatchedPathname, null),
		slotId,
		targetMatchedUrl: targetMatchedPathname,
		targetRouteId: AppElementsWire.encodeRouteId(targetMatchedPathname, null)
	};
	return {
		displayPathname: input.displayPathname,
		interception,
		interceptionContext,
		matchedRoutePathname,
		pageId,
		routeId,
		targetMatchedPathname
	};
}
//#endregion
export { createAppPageRenderIdentity, normalizeAppPageInterceptionProofPathname };
