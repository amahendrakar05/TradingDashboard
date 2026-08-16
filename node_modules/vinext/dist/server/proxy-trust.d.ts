import { IncomingMessage } from "node:http";

//#region src/server/proxy-trust.d.ts
/**
 * Hosts that are allowed as `X-Forwarded-Host` values (stored lowercase).
 *
 * This Set is intentionally mutable so tests can add/remove entries
 * without reloading the module, and so existing call sites that imported
 * `trustedHosts` from `prod-server.ts` keep the same semantics.
 */
declare const trustedHosts: Set<string>;
/**
 * Whether to trust `X-Forwarded-Proto` from upstream proxies.
 *
 * Enabled when `VINEXT_TRUST_PROXY=1` or when `VINEXT_TRUSTED_HOSTS` is
 * non-empty (having trusted hosts implies a trusted proxy). Computed at
 * module load time, matching the existing prod-server behavior.
 */
declare const trustProxy: boolean;
/**
 * Resolve the request protocol, honoring `X-Forwarded-Proto` only when
 * the trust-proxy gate is enabled. Defaults to `"http"`.
 *
 * Accepts either a Node `IncomingMessage` or a Fetch `Headers` instance
 * so the same trust logic can be applied in both server flavors.
 */
declare function resolveRequestProtocol(source: IncomingMessage | Headers): "http" | "https";
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
declare function resolveRequestHost(source: IncomingMessage | Headers, fallback: string): string;
//#endregion
export { resolveRequestHost, resolveRequestProtocol, trustProxy, trustedHosts };