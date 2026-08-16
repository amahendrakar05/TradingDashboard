import type { Operations, URLExtractor, URLGenerator, URLTransformer } from "../types.js";
/**
 * Vercel Image Optimization provider.
 * @see https://vercel.com/docs/image-optimization
 */
export interface VercelOperations extends Operations {
    /**
     * Resize the image to a specified width in pixels.
     * Shorthand for `width`.
     * @type {number} Range: 1-8192
     */
    w?: number;
    /**
     * Image quality for lossy formats like JPEG and WebP.
     * Shorthand for `quality`.
     * @type {number} Range: 1-100
     */
    q?: number;
}
export interface VercelOptions {
    baseUrl?: string;
    /**
     * Either "_vercel" or "_next". Defaults to "_vercel".
     */
    prefix?: string;
    /**
     * Always use the Vercel CDN, even if the source URL matches another provider.
     */
    force?: boolean;
}
export declare const generate: URLGenerator<"vercel">;
export declare const extract: URLExtractor<"vercel">;
export declare const transform: URLTransformer<"vercel">;
//# sourceMappingURL=vercel.d.ts.map