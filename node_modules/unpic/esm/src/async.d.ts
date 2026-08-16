import type { ProviderOperations, ProviderOptions } from "./providers/types.js";
import type { ProviderModule } from "./providers/types.js";
import type { ImageCdn, URLExtractor, URLGenerator, URLTransformer, UrlTransformerOptions } from "./types.js";
/**
 * Returns a parser function if the given URL is from a known image CDN
 */
export declare const getExtractorForUrl: <TCDN extends ImageCdn = ImageCdn>(url: string | URL) => Promise<URLExtractor<TCDN> | undefined>;
/**
 * Dynamically loads the module for the given provider
 */
export declare function getModuleForProvider<TCDN extends ImageCdn>(cdn: TCDN | false | undefined): Promise<ProviderModule<TCDN>> | undefined;
/**
 * Dynamically loads the extract function for the given provider
 */
export declare const getExtractorForProvider: <TCDN extends ImageCdn>(cdn: TCDN | false | undefined) => Promise<URLExtractor<TCDN> | undefined>;
/**
 * Dynamically loads the generate function for the given provider
 */
export declare const getGeneratorForProvider: <TCDN extends ImageCdn>(cdn: TCDN | false | undefined) => Promise<URLGenerator<TCDN> | undefined>;
/**
 * Dynamically loads the transform function for the given provider
 */
export declare const getTransformerForProvider: <TCDN extends ImageCdn>(cdn: TCDN | false | undefined) => Promise<URLTransformer<TCDN> | undefined>;
/**
 * Transforms an image URL to a new URL with the given options.
 * If the URL is not from a known image CDN it returns undefined.
 *
 * This function is async because it dynamically loads the module for the provider.
 * If you need a synchronous version, import from the root module instead.
 */
export declare function transformUrl<TCDN extends ImageCdn = ImageCdn>(url: string | URL, { provider, cdn: cdnOption, fallback, ...operations }: UrlTransformerOptions<TCDN>, providerOperations?: Partial<ProviderOperations>, providerOptions?: Partial<ProviderOptions>): Promise<string | undefined>;
//# sourceMappingURL=async.d.ts.map