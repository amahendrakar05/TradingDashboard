import domains from "../data/domains.js";
import subdomains from "../data/subdomains.js";
import paths from "../data/paths.js";
import { toUrl } from "./utils.js";
const cdnDomains = new Map(Object.entries(domains));
const cdnSubdomains = Object.entries(subdomains);
const cdnPaths = Object.entries(paths);
/**
 * Detects the image CDN provider for a given URL.
 */
export function getProviderForUrl(url) {
    return getProviderForUrlByDomain(url) || getProviderForUrlByPath(url);
}
/**
 * @deprecated Use `getProviderForUrl` instead.
 */
export const getImageCdnForUrl = getProviderForUrl;
export function getProviderForUrlByDomain(url) {
    if (typeof url === "string" && !url.startsWith("https://")) {
        return false;
    }
    const { hostname } = toUrl(url);
    const cdn = cdnDomains.get(hostname);
    if (cdn) {
        return cdn;
    }
    return cdnSubdomains.find(([subdomain]) => hostname.endsWith(subdomain))?.[1] || false;
}
/**
 * @deprecated Use `getProviderForUrlByDomain` instead.
 */
export const getImageCdnForUrlByDomain = getProviderForUrlByDomain;
/**
 * Gets the image CDN provider for a given URL by its path.
 */
export function getProviderForUrlByPath(url) {
    // Allow relative URLs
    const { pathname } = toUrl(url);
    return cdnPaths.find(([path]) => pathname.startsWith(path))?.[1] || false;
}
/**
 * @deprecated Use `getProviderForUrlByPath` instead.
 */
export const getImageCdnForUrlByPath = getProviderForUrlByPath;
