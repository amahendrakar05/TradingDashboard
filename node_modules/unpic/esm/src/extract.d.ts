import type { ProviderOptions, URLExtractorMap } from "./providers/types.js";
import type { ImageCdn, ParseURLResult, URLExtractor } from "./types.js";
export declare const parsers: URLExtractorMap;
/**
 * Returns a parser function if the given URL is from a known image CDN
 */
export declare const getExtractorForUrl: <TCDN extends ImageCdn = ImageCdn>(url: string | URL) => URLExtractor<TCDN> | undefined;
export declare const getExtractorForProvider: <TCDN extends ImageCdn>(cdn: TCDN | false | undefined) => URLExtractor<TCDN> | undefined;
/**
 * Parses an image URL into its components.
 * If the URL is not from a known image CDN it returns undefined.
 */
export declare const parseUrl: <TCDN extends ImageCdn = ImageCdn>(url: string | URL, cdn?: TCDN, options?: ProviderOptions[TCDN]) => ParseURLResult<TCDN>;
//# sourceMappingURL=extract.d.ts.map