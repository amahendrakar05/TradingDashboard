import { ImageFormat, Operations, URLExtractor, URLGenerator, type URLTransformer } from "../types.js";
export type OverlayAlignment = "top" | "bottom" | "left" | "right" | "middle" | "center";
export type EdgeValues = number | `${number},${number}` | `${number},${number},${number}` | `${number},${number},${number},${number}`;
export interface ContentstackOperations extends Operations<"pjpg" | "webpll" | "webply"> {
    /**
     * Defines how the image fits into the specified dimensions.
     */
    fit?: "crop" | "bounds";
    /**
     * Enables automatic format selection (usually WebP).
     */
    auto?: "webp" | "avif";
    format?: ImageFormat | "pjpg" | "webpll" | "webply";
    /**
     * Disables upscaling of images. True by default.
     */
    disable?: "upscale" | false;
    /**
     * Trim an image from the edges. The value for this parameter can be given in pixels or percentage.
     */
    trim?: EdgeValues;
    /**
     * Control the cardinal orientation of the given image
     */
    orient?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
    /**
     * Overlay an image on top of another image.
     */
    overlay?: string;
    /**
     * Define the position of the overlay image
     */
    "overlay-align"?: OverlayAlignment | `${OverlayAlignment},${OverlayAlignment}`;
    /**
     * Pad the image edges
     */
    padding?: EdgeValues;
    /**
     * Pad the overlay edges
     */
    "overlay-padding"?: EdgeValues;
    /**
     * Set the background color for padding
     */
    bgcolor?: string;
    /**
     * Device pixel ratio
     */
    dpr?: number;
    /**
     * Blur the image
     */
    blur?: number;
    /**
     * Extract a frame from an animated gif. Only the first frame is supported.
     */
    frame?: 1;
    /**
     * Sharpen the image
     */
    sharpen?: `a${number},r${number},t${number}`;
    /**
     * Saturation of the image
     */
    saturation?: number;
    /**
     * Contrast of the image
     */
    contrast?: number;
    /**
     * Brightness of the image
     */
    brightness?: number;
    /**
     * Sets the resize filter
     */
    filter?: "nearest" | "bilinear" | "bicubic" | "lanczos3" | "lanczos2";
    /**
     * Increase the size of the canvas that surrounds an image
     */
    canvas?: string;
}
export interface ContentstackOptions {
    /**
     * The base URL for the images.
     */
    baseURL?: "https://images.contentstack.io/" | "https://eu-images.contentstack.com/" | "https://azure-na-images.contentstack.com/" | "https://azure-eu-images.contentstack.com/" | (string & {});
}
export declare const generate: URLGenerator<"contentstack">;
export declare const extract: URLExtractor<"contentstack">;
export declare const transform: URLTransformer<"contentstack">;
//# sourceMappingURL=contentstack.d.ts.map