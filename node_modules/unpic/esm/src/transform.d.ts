import type { ImageCdn, URLTransformer, UrlTransformerOptions } from "./types.js";
import type { ProviderOperations, ProviderOptions } from "./providers/types.js";
/**
 * Returns a transformer function if the given CDN is supported
 */
export declare function getTransformerForCdn<TCDN extends ImageCdn>(cdn: TCDN | false | undefined): URLTransformer<TCDN> | undefined;
/**
 * Transforms an image URL to a new URL with the given options.
 * If the URL is not from a known image CDN it returns undefined.
 */
export declare function transformUrl<TCDN extends ImageCdn = ImageCdn>({ url, provider, cdn: cdnOption, fallback, width, height, format, quality, }: UrlTransformerOptions<TCDN>, providerOperations?: Partial<ProviderOperations>, providerOptions?: Partial<ProviderOptions>): string | undefined;
//# sourceMappingURL=transform.d.ts.map