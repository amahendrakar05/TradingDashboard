import type { ImageFormat, Operations, URLExtractor, URLGenerator, URLTransformer } from "../types.js";
/**
 * @see https://docs.netlify.com/image-cdn/overview/
 */
export interface NetlifyOperations extends Operations<"blurhash"> {
    /**
     * Resize the image to a specified width in pixels.
     * @type {number} Range: 1-8192
     */
    w?: number;
    /**
     * Resize the image to a specified height in pixels.
     * @type {number} Range: 1-8192
     */
    h?: number;
    /**
     * Fit the image within the specified dimensions.
     */
    fit?: "contain" | "cover" | "fill";
    /**
     * Image quality for lossy formats like JPEG and WebP.
     * Shorthand for `quality`.
     * @type {number} Range: 1-100
     */
    q?: number;
    /**
     * Image format conversion.
     * Shorthand for `format`.
     */
    fm?: ImageFormat | "blurhash";
    /**
     * Position of the image when using fit=cover.
     * Shorthand for `position`.
     */
    position?: "center" | "top" | "bottom" | "left" | "right";
}
export interface NetlifyOptions {
    /**
     * Base URL for the Netlify Image CDN. Defaults to relative URLs.
     */
    baseUrl?: string;
    /**
     * Always use the Netlify Image CDN, even if the source URL matches another provider.
     */
    force?: boolean;
}
export declare const generate: URLGenerator<"netlify">;
export declare const extract: URLExtractor<"netlify">;
export declare const transform: URLTransformer<"netlify">;
//# sourceMappingURL=netlify.d.ts.map