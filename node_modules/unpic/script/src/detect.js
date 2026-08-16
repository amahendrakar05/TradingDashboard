"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getImageCdnForUrlByPath = exports.getImageCdnForUrlByDomain = exports.getImageCdnForUrl = void 0;
exports.getProviderForUrl = getProviderForUrl;
exports.getProviderForUrlByDomain = getProviderForUrlByDomain;
exports.getProviderForUrlByPath = getProviderForUrlByPath;
const domains_js_1 = __importDefault(require("../data/domains.js"));
const subdomains_js_1 = __importDefault(require("../data/subdomains.js"));
const paths_js_1 = __importDefault(require("../data/paths.js"));
const utils_js_1 = require("./utils.js");
const cdnDomains = new Map(Object.entries(domains_js_1.default));
const cdnSubdomains = Object.entries(subdomains_js_1.default);
const cdnPaths = Object.entries(paths_js_1.default);
/**
 * Detects the image CDN provider for a given URL.
 */
function getProviderForUrl(url) {
    return getProviderForUrlByDomain(url) || getProviderForUrlByPath(url);
}
/**
 * @deprecated Use `getProviderForUrl` instead.
 */
exports.getImageCdnForUrl = getProviderForUrl;
function getProviderForUrlByDomain(url) {
    if (typeof url === "string" && !url.startsWith("https://")) {
        return false;
    }
    const { hostname } = (0, utils_js_1.toUrl)(url);
    const cdn = cdnDomains.get(hostname);
    if (cdn) {
        return cdn;
    }
    return cdnSubdomains.find(([subdomain]) => hostname.endsWith(subdomain))?.[1] || false;
}
/**
 * @deprecated Use `getProviderForUrlByDomain` instead.
 */
exports.getImageCdnForUrlByDomain = getProviderForUrlByDomain;
/**
 * Gets the image CDN provider for a given URL by its path.
 */
function getProviderForUrlByPath(url) {
    // Allow relative URLs
    const { pathname } = (0, utils_js_1.toUrl)(url);
    return cdnPaths.find(([path]) => pathname.startsWith(path))?.[1] || false;
}
/**
 * @deprecated Use `getProviderForUrlByPath` instead.
 */
exports.getImageCdnForUrlByPath = getProviderForUrlByPath;
