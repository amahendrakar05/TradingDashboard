import type { Operations, URLExtractor, URLGenerator, URLTransformer } from "../types.js";
export interface CloudflareImagesOperations extends Operations {
    /**
     * Fit mode for the image.
     */
    fit?: "scale-down" | "contain" | "cover" | "crop" | "pad";
    /**
     * Gravity for the image when using fit modes that crop.
     */
    gravity?: "auto" | "side" | "top" | "bottom" | "left" | "right";
    /**
     * Additional Cloudflare-specific operations.
     */
    [key: string]: string | number | undefined;
}
export interface CloudflareImagesOptions {
    host?: string;
    accountHash?: string;
    imageId?: string;
}
export declare const generate: URLGenerator<"cloudflare_images">;
export declare const extract: URLExtractor<"cloudflare_images">;
export declare const transform: URLTransformer<"cloudflare_images">;
//# sourceMappingURL=cloudflare_images.d.ts.map