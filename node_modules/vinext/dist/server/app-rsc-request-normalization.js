import { normalizePathnameForRouteMatchStrict } from "../routing/utils.js";
import { hasBasePath, stripBasePath } from "../utils/base-path.js";
import { VINEXT_CLIENT_REUSE_MANIFEST_HEADER, VINEXT_INTERCEPTION_CONTEXT_HEADER, VINEXT_MOUNTED_SLOTS_HEADER, VINEXT_RSC_RENDER_MODE_HEADER } from "./headers.js";
import { normalizePath } from "./normalize-path.js";
import { badRequestResponse, notFoundResponse } from "./http-error-responses.js";
import { guardProtocolRelativeUrl } from "./request-pipeline.js";
import { normalizeMountedSlotsHeader } from "./app-mounted-slots-header.js";
import { APP_RSC_RENDER_MODE_NAVIGATION, parseAppRscRenderMode } from "./app-rsc-render-mode.js";
import { stripRscSuffix } from "./app-rsc-cache-busting.js";
import { parseClientReuseManifestHeader } from "./client-reuse-manifest.js";
import { normalizeInterceptionContextHeader } from "./app-interception-context-header.js";
//#region src/server/app-rsc-request-normalization.ts
/**
* Normalize an App Router RSC request.
*
* Performs all security-sensitive and compatibility-sensitive preprocessing before
* route matching. The ordering of steps is security-critical — changing it introduces
* vulnerabilities:
*
*   1. Parse URL
*   2. Protocol-relative URL guard — on the raw pathname, BEFORE normalizePath collapses
*      `//` to `/`. If the guard ran after normalization, `//evil.com` → `/evil.com`
*      would bypass the check and reach the trailing-slash redirector, which echoes the
*      path into a `Location` header that browsers interpret as protocol-relative.
*   3. Strict percent-decode each segment — throws on malformed sequences (→ 400). Must
*      run before basePath check so %2F-encoded slashes cannot create fake basePath prefixes.
*   4. Collapse double-slashes, resolve `.` and `..` segments (normalizePath)
*   5. basePath check + strip — 404 when pathname lacks the basePath prefix.
*      `/__vinext/` bypasses this for internal prerender endpoints.
*   6. RSC detection: `.rsc` suffix or Next-style `RSC: 1`. The internal
*      `_rsc` cache-busting query is validated separately so full-route Flight
*      responses do not share the canonical HTML URL in caches that ignore Vary.
*   7. cleanPathname — pathname with `.rsc` suffix stripped
*   8. Sanitize X-Vinext-Interception-Context — strip null bytes (header injection)
*   9. Normalize x-vinext-mounted-slots — dedup and sort for canonical cache keys
*   10. Read semantic render mode for refresh/action payload rendering
*   11. Parse ClientReuseManifest hints on canonical RSC payload requests
*
* @returns A 400 or 404 Response for invalid or out-of-scope inputs,
*          or a NormalizedRscRequest for valid requests.
*/
function normalizeRscRequest(request, basePath, allowOutsideBasePath = false) {
	const url = new URL(request.url);
	const protoGuard = guardProtocolRelativeUrl(url.pathname);
	if (protoGuard) return protoGuard;
	let decoded;
	try {
		decoded = normalizePathnameForRouteMatchStrict(url.pathname);
	} catch {
		return badRequestResponse();
	}
	let pathname = normalizePath(decoded);
	let requestPathname = url.pathname;
	let hadBasePath = true;
	if (basePath) {
		hadBasePath = hasBasePath(requestPathname, basePath);
		if (!hadBasePath && !pathname.startsWith("/__vinext/") && !allowOutsideBasePath) return notFoundResponse();
		if (hadBasePath) {
			pathname = stripBasePath(pathname, basePath);
			requestPathname = stripBasePath(requestPathname, basePath);
		}
	}
	const isRscRequest = pathname.endsWith(".rsc") || request.headers.get("RSC") === "1";
	const cleanPathname = stripRscSuffix(pathname);
	const requestCleanPathname = stripRscSuffix(requestPathname);
	const interceptionContextHeader = normalizeInterceptionContextHeader(request.headers.get(VINEXT_INTERCEPTION_CONTEXT_HEADER));
	const mountedSlotsHeader = normalizeMountedSlotsHeader(request.headers.get(VINEXT_MOUNTED_SLOTS_HEADER));
	const renderMode = isRscRequest ? parseAppRscRenderMode(request.headers.get(VINEXT_RSC_RENDER_MODE_HEADER)) : APP_RSC_RENDER_MODE_NAVIGATION;
	return {
		clientReuseManifest: isRscRequest ? parseClientReuseManifestHeader(request.headers.get(VINEXT_CLIENT_REUSE_MANIFEST_HEADER)) : { kind: "absent" },
		hadBasePath,
		url,
		pathname,
		cleanPathname,
		requestCleanPathname,
		isRscRequest,
		interceptionContextHeader,
		mountedSlotsHeader,
		renderMode
	};
}
//#endregion
export { normalizeMountedSlotsHeader, normalizeRscRequest };
