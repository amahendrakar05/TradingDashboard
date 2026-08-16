//#region src/shims/image-config.d.ts
/**
 * Image remote pattern validation.
 *
 * Validates remote image URLs against the `images.remotePatterns` and
 * `images.domains` config from next.config.js. This prevents SSRF and
 * open-redirect attacks by blocking URLs that don't match any configured
 * pattern.
 *
 * Pattern matching follows Next.js semantics:
 * - `*` matches a single segment (subdomain in hostname, path segment in pathname)
 * - `**` matches any number of segments
 * - protocol, port, and search are matched exactly when specified
 */
type RemotePattern = {
  protocol?: string;
  hostname: string;
  port?: string;
  pathname?: string;
  search?: string;
};
/**
 * Check whether a URL matches a single remote pattern.
 * Follows the same semantics as Next.js's matchRemotePattern().
 */
declare function matchRemotePattern(pattern: RemotePattern, url: URL): boolean;
/**
 * Check whether a URL matches any configured remote pattern or legacy domain.
 */
declare function hasRemoteMatch(domains: string[], remotePatterns: RemotePattern[], url: URL): boolean;
/**
 * Determine whether a string is a private (non-routable) IP address.
 * Works for IPv4 and IPv6, including bracketed and IPv4-mapped forms.
 *
 * Uses ipaddr.js with range() !== 'unicast' — the same approach Next.js
 * takes (via packages/next/src/server/is-private-ip.ts). This covers all
 * IETF non-unicast ranges (CGNAT, benchmarking, multicast, reserved,
 * teredo, documentation, discard, NAT64, etc.) without hand-rolling CIDR
 * prefix checks that are easy to get wrong.
 *
 * https://github.com/vercel/next.js/blob/canary/packages/next/src/server/is-private-ip.ts
 */
declare function isPrivateIp(ip: string): boolean;
//#endregion
export { RemotePattern, hasRemoteMatch, isPrivateIp, matchRemotePattern };