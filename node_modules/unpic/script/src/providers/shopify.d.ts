import type { ImageFormat, Operations, URLExtractor, URLGenerator, URLTransformer } from "../types.js";
/**
 * Shopify Image API operations
 */
export interface ShopifyOperations extends Operations {
    /**
     * Crop option, such as top, bottom, or center.
     */
    crop?: "center" | "top" | "bottom" | "left" | "right";
    /**
     * Background color for padding.
     */
    pad_color?: string;
    /**
     * @deprecated Format is not supported by Shopify.
     */
    format?: ImageFormat;
}
export declare const generate: URLGenerator<"shopify">;
export declare const extract: URLExtractor<"shopify">;
export declare const transform: URLTransformer<"shopify">;
//# sourceMappingURL=shopify.d.ts.map