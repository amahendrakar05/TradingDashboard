//#region src/server/http-error-responses.ts
/**
* Build a 400 Bad Request plain-text response.
*
* Used for malformed percent-encoding, invalid HTTP methods (where Next.js
* returns 400), and other request-shape validation failures.
*/
function badRequestResponse(init) {
	return new Response("Bad Request", {
		status: 400,
		headers: init?.headers
	});
}
/**
* Build a 403 Forbidden plain-text response.
*
* Used by CSRF origin validation and dev-server origin checks.
*/
function forbiddenResponse() {
	return new Response("Forbidden", {
		status: 403,
		headers: { "Content-Type": "text/plain" }
	});
}
/**
* Build a 404 Not Found plain-text response.
*
* The body matches Next.js's plain-text 404 response exactly. Next.js writes
* `res.end('This page could not be found')` (no trailing period) for the
* fallback 404 path; see in `.nextjs-ref`:
*   - packages/next/src/server/route-modules/pages/pages-handler.ts L121, L535
*   - packages/next/src/build/templates/app-route.ts L170, L349
*   - packages/next/src/build/templates/app-page.ts L701, L1043
* (The React-rendered not-found component in `packages/next/src/client/components/builtin/not-found.tsx`
* uses the same text with a trailing period — that variant is rendered as HTML,
* not returned as the plain-text body.)
*
* The `headers` option lets call sites merge middleware response headers into
* the 404, matching the pattern used by `app-rsc-handler` after a route match
* fails but middleware has already contributed headers.
*/
function notFoundResponse(init) {
	return new Response("This page could not be found", {
		status: 404,
		headers: init?.headers
	});
}
/**
* Build a 404 plain-text response for invalid `_next/static/*` paths.
*
* Next.js short-circuits invalid `_next/static/*` requests with a plain-text
* `"Not Found"` body (NOT the rendered HTML 404 page) — saves bandwidth on
* what is almost certainly a misbehaving client requesting a stale chunk.
*
* Body and content-type match Next.js exactly:
*   res.statusCode = 404
*   res.setHeader('Content-Type', 'text/plain; charset=utf-8')
*   res.end('Not Found')
*
* @see packages/next/src/server/lib/router-server.ts in `.nextjs-ref`
*/
function notFoundStaticAssetResponse() {
	return new Response("Not Found", {
		status: 404,
		headers: { "Content-Type": "text/plain; charset=utf-8" }
	});
}
/**
* Build a 405 Method Not Allowed plain-text response with the `Allow` header set.
*
* `allowedMethods` is rendered as the comma-separated `Allow` header value.
* Existing headers (e.g. middleware response headers) can be merged via `init.headers`;
* the `Allow` header takes precedence and overwrites any colliding entry.
*/
function methodNotAllowedResponse(allowedMethods, init) {
	const headers = new Headers(init?.headers);
	headers.set("Allow", allowedMethods);
	return new Response("Method Not Allowed", {
		status: 405,
		headers
	});
}
/**
* Build a 413 Payload Too Large plain-text response.
*
* Used by server action body-size enforcement.
*/
function payloadTooLargeResponse() {
	return new Response("Payload Too Large", { status: 413 });
}
/**
* Build a 500 Internal Server Error plain-text response.
*
* The `message` argument lets dev-mode handlers surface failure details while
* production paths fall back to the canonical body. Pass `undefined` (or omit)
* to use the canonical "Internal Server Error" body.
*/
function internalServerErrorResponse(message, init) {
	return new Response(message ?? "Internal Server Error", {
		status: 500,
		headers: init?.headers
	});
}
//#endregion
export { badRequestResponse, forbiddenResponse, internalServerErrorResponse, methodNotAllowedResponse, notFoundResponse, notFoundStaticAssetResponse, payloadTooLargeResponse };
