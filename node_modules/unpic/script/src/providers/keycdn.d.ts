import type { ImageFormat, Operations, URLExtractor, URLGenerator, URLTransformer } from "../types.js";
/**
 * @see https://www.keycdn.com/support/image-processing
 */
export interface KeyCDNOperations extends Operations {
    /**
     * Trim similar pixels from the edges.
     * @type {number} Range: 0-100
     */
    trim?: number;
    /**
     * Crop options: "smart" for automatic cropping, or pixel-based.
     * @type {string | {width: number, height: number, x?: number, y?: number} | `fp,${number},${number},${number}` | `fpd,${number},${number}`}
     */
    crop?: "smart" | `${number},${number}` | `${number},${number},${number},${number}` | `fp,${number},${number},${number}` | `fpd,${number},${number}`;
    /**
     * Resize fit method.
     * @type {('cover' | 'contain' | 'fill' | 'inside' | 'outside')}
     */
    fit?: "cover" | "contain" | "fill" | "inside" | "outside";
    /**
     * Image position for fit: 'cover' or 'contain'.
     * @type {('top' | 'right' | 'bottom' | 'left')}
     */
    position?: "top" | "right" | "bottom" | "left";
    /**
     * Whether to enlarge the image beyond original size.
     */
    enlarge?: 0 | 1 | boolean;
    /**
     * Background color, either as a hex string or rgba values.
     * @type {string | `${number},${number},${number}` | `${number},${number},${number},${number}`}
     */
    bg?: string | `${number},${number},${number}` | `${number},${number},${number},${number}`;
    /**
     * Extend the image with padding.
     * @type {number | {top: number, right: number, bottom: number, left: number}}
     */
    extend?: number | {
        top: number;
        right: number;
        bottom: number;
        left: number;
    };
    /**
     * Rotate the image.
     * @type {number} Range: -359 to 359 degrees
     */
    rotate?: number;
    /**
     * Flip image vertically.
     */
    flip?: 0 | 1 | boolean;
    /**
     * Flop image horizontally.
     */
    flop?: 0 | 1 | boolean;
    /**
     * Sharpen the image.
     * @type {number} Range: 0-100
     */
    sharpen?: number;
    /**
     * Blur the image.
     * @type {number} Range: 0.3-100
     */
    blur?: number;
    /**
     * Apply gamma correction.
     * @type {number} Range: 0-3
     */
    gamma?: number;
    /**
     * Invert image colors.
     */
    negate?: 0 | 1 | boolean;
    /**
     * Normalize image contrast.
     */
    normalize?: 0 | 1 | boolean;
    /**
     * Apply threshold.
     * @type {number} Range: 0-255
     */
    threshold?: number;
    /**
     * Apply tint using hex color.
     */
    tint?: string;
    /**
     * Convert the image to grayscale.
     */
    grayscale?: 0 | 1 | boolean;
    /**
     * Remove alpha channel from the image.
     */
    removealpha?: 0 | 1 | boolean;
    /**
     * URL for an overlay image.
     */
    olurl?: string;
    /**
     * Overlay alignment.
     */
    olalign?: "center" | "top" | "topright" | "right" | "bottomright" | "bottom" | "bottomleft" | "topleft";
    /**
     * Overlay X-axis coordinate.
     * @type {number} Range: 0-2000 pixels
     */
    olx?: number;
    /**
     * Overlay Y-axis coordinate.
     * @type {number} Range: 0-2000 pixels
     */
    oly?: number;
    /**
     * Overlay width in pixels or percentage.
     * @type {number | `${number}%`}
     */
    olwidth?: number | `${number}%`;
    /**
     * Overlay height in pixels or percentage.
     * @type {number | `${number}%`}
     */
    olheight?: number | `${number}%`;
    /**
     * Overlay transparency.
     * @type {number} Range: 1-99
     */
    olalpha?: number;
    /**
     * Repeat overlay.
     */
    olrepeat?: 0 | 1 | boolean;
    /**
     * Output image format.
     */
    format?: ImageFormat | "tiff";
    /**
     * Image quality.
     * @type {number} Range: 0-100
     */
    quality?: number;
    /**
     * Progressive scan for JPEG/PNG.
     */
    progressive?: 0 | 1 | boolean;
    /**
     * PNG compression level.
     * @type {number} Range: 0-9
     */
    compression?: number;
    /**
     * Adaptive row filtering for PNG.
     */
    adaptive?: 0 | 1 | boolean;
    /**
     * Quality of WebP alpha layer.
     * @type {number} Range: 0-100
     */
    alphaquality?: number;
    /**
     * Lossless encoding for WebP.
     */
    lossless?: 0 | 1 | boolean;
    /**
     * Near-lossless compression for WebP.
     */
    nearlossless?: 0 | 1 | boolean;
    /**
     * Preserve image metadata (EXIF, IPTC, XMP).
     */
    metadata?: 0 | 1 | boolean;
}
export declare const generate: URLGenerator<"keycdn">;
export declare const extract: URLExtractor<"keycdn">;
export declare const transform: URLTransformer<"keycdn">;
//# sourceMappingURL=keycdn.d.ts.map