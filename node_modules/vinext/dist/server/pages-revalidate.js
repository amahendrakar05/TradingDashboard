import "./headers.js";
import { PRERENDER_REVALIDATE_HEADER, PRERENDER_REVALIDATE_ONLY_GENERATED_HEADER, getRevalidateSecret } from "./isr-cache.js";
import { resolveRequestHost, resolveRequestProtocol } from "./proxy-trust.js";
//#region src/server/pages-revalidate.ts
async function performOnDemandRevalidate(source, urlPath, opts = {}) {
	if (typeof urlPath !== "string" || !urlPath.startsWith("/")) throw new Error(`Invalid urlPath provided to revalidate(), must be a path e.g. /blog/post-1, received ${urlPath}`);
	const proto = resolveRequestProtocol(source);
	const host = resolveRequestHost(source, "localhost");
	const target = new URL(urlPath, `${proto}://${host}`);
	const headers = { [PRERENDER_REVALIDATE_HEADER]: getRevalidateSecret() };
	if (opts.unstable_onlyGenerated) headers[PRERENDER_REVALIDATE_ONLY_GENERATED_HEADER] = "1";
	const res = await fetch(target, {
		method: "HEAD",
		headers
	});
	if (!(res.headers.get("x-nextjs-cache")?.toUpperCase() === "REVALIDATED" || res.status === 200 || res.status === 404 && opts.unstable_onlyGenerated === true)) throw new Error(`Failed to revalidate ${urlPath}: ${res.status}`);
}
//#endregion
export { performOnDemandRevalidate };
