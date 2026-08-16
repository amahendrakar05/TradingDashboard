import type { ImageCdn } from "./types.js";
/**
 * Detects the image CDN provider for a given URL.
 */
export declare function getProviderForUrl(url: string | URL): ImageCdn | false;
/**
 * @deprecated Use `getProviderForUrl` instead.
 */
export declare const getImageCdnForUrl: typeof getProviderForUrl;
export declare function getProviderForUrlByDomain(url: string | URL): ImageCdn | false;
/**
 * @deprecated Use `getProviderForUrlByDomain` instead.
 */
export declare const getImageCdnForUrlByDomain: typeof getProviderForUrlByDomain;
/**
 * Gets the image CDN provider for a given URL by its path.
 */
export declare function getProviderForUrlByPath(url: string | URL): ImageCdn | false;
/**
 * @deprecated Use `getProviderForUrlByPath` instead.
 */
export declare const getImageCdnForUrlByPath: typeof getProviderForUrlByPath;
//# sourceMappingURL=detect.d.ts.map