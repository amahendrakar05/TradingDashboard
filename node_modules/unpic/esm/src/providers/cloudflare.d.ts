import { Operations, URLExtractor, URLGenerator, type URLTransformer } from "../types.js";
import { ImageFormat } from "../types.js";
/**
 * Image transform options for Cloudflare URL-based image processing.
 */
export interface CloudflareOperations extends Operations<"auto" | "json"> {
    /** Preserve animation frames from GIFs, default true. */
    anim?: boolean;
    /** Background color for transparent images. Accepts CSS color values. */
    background?: string;
    /** Blur radius (1 to 250). */
    blur?: number;
    /** Border options, including color and width for each side. */
    border?: {
        color: string;
        width?: number;
        top?: number;
        right?: number;
        bottom?: number;
        left?: number;
    };
    /** Brightness factor, 1.0 means no change. */
    brightness?: number;
    /** Choose a faster but lower-quality compression method. */
    compression?: "fast";
    /** Contrast factor, 1.0 means no change. */
    contrast?: number;
    /** Device Pixel Ratio multiplier, default is 1. */
    dpr?: number;
    /** Resizing mode, preserving aspect ratio. */
    fit?: "scale-down" | "contain" | "cover" | "crop" | "pad";
    /** Output image format, or "auto" to choose based on browser support. */
    format?: ImageFormat | "auto" | "json";
    f?: ImageFormat | "auto" | "json";
    /** Gamma correction factor. */
    gamma?: number;
    /** Cropping gravity (focal point) or alignment. */
    gravity?: "auto" | "left" | "right" | "top" | "bottom" | string;
    /** Control the preservation of metadata. */
    metadata?: "keep" | "copyright" | "none";
    /** Redirect to original image if transformation fails. */
    onerror?: "redirect";
    /** Rotate the image by 90, 180, or 270 degrees. */
    rotate?: 90 | 180 | 270;
    /** Strength of sharpening filter (0-10). */
    sharpen?: number;
    /** Trim options to remove pixels from edges. */
    trim?: {
        top?: number;
        right?: number;
        bottom?: number;
        left?: number;
        width?: number;
        height?: number;
    };
}
export interface CloudflareOptions {
    /** The Cloudflare domain */
    domain?: string;
}
export declare const generate: URLGenerator<"cloudflare">;
export declare const extract: URLExtractor<"cloudflare">;
export declare const transform: URLTransformer<"cloudflare">;
//# sourceMappingURL=cloudflare.d.ts.map