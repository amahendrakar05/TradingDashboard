//#region src/server/proxy-trust.ts
function firstHeaderValue(value) {
	if (value === void 0 || value === null) return void 0;
	return Array.isArray(value) ? value[0] : value;
}
/**
* Hosts that are allowed as `X-Forwarded-Host` values (stored lowercase).
*
* This Set is intentionally mutable so tests can add/remove entries
* without reloading the module, and so existing call sites that imported
* `trustedHosts` from `prod-server.ts` keep the same semantics.
*/
const trustedHosts = new Set((process.env.VINEXT_TRUSTED_HOSTS ?? "").split(",").map((h) => h.trim().toLowerCase()).filter(Boolean));
/**
* Whether to trust `X-Forwarded-Proto` from upstream proxies.
*
* Enabled when `VINEXT_TRUST_PROXY=1` or when `VINEXT_TRUSTED_HOSTS` is
* non-empty (having trusted hosts implies a trusted proxy). Computed at
* module load time, matching the existing prod-server behavior.
*/
const trustProxy = process.env.VINEXT_TRUST_PROXY === "1" || trustedHosts.size > 0;
/**
* Resolve the request protocol, honoring `X-Forwarded-Proto` only when
* the trust-proxy gate is enabled. Defaults to `"http"`.
*
* Accepts either a Node `IncomingMessage` or a Fetch `Headers` instance
* so the same trust logic can be applied in both server flavors.
*/
function resolveRequestProtocol(source) {
	if (!trustProxy) return "http";
	const candidate = readForwardedProto(source)?.split(",")[0]?.trim();
	return candidate === "https" || candidate === "http" ? candidate : "http";
}
/**
* Resolve the request host. `X-Forwarded-Host` is honored only when its
* value matches the `trustedHosts` allow-list. Falls back to the raw
* `Host` header and then to `fallback`.
*
* Ignoring `X-Forwarded-Host` by default prevents host header poisoning
* (open redirects, cache poisoning) where an attacker sends
* `X-Forwarded-Host: evil.com` to a server that resolves redirect URLs
* against `request.url`.
*/
function resolveRequestHost(source, fallback) {
	const rawForwarded = readForwardedHost(source);
	if (rawForwarded && trustedHosts.size > 0) {
		const forwardedHost = rawForwarded.split(",")[0]?.trim().toLowerCase();
		if (forwardedHost && trustedHosts.has(forwardedHost)) return forwardedHost;
	}
	return readHost(source) || fallback;
}
function readForwardedProto(source) {
	if (isWebHeaders(source)) return source.get("x-forwarded-proto") ?? void 0;
	return firstHeaderValue(source.headers["x-forwarded-proto"]);
}
function readForwardedHost(source) {
	if (isWebHeaders(source)) return source.get("x-forwarded-host") ?? void 0;
	return firstHeaderValue(source.headers["x-forwarded-host"]);
}
function readHost(source) {
	if (isWebHeaders(source)) return source.get("host") ?? void 0;
	return firstHeaderValue(source.headers["host"]);
}
function isWebHeaders(source) {
	return typeof source.get === "function";
}
//#endregion
export { resolveRequestHost, resolveRequestProtocol, trustProxy, trustedHosts };
