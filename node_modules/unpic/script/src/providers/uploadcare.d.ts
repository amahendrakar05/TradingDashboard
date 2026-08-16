import type { Operations, URLExtractor, URLGenerator, URLTransformer } from "../types.js";
type Dimension = number | string;
type Dimensions = `${Dimension}x${Dimension}`;
export interface UploadcareOperations extends Operations {
    /** Resize the image to fit within the specified dimensions while maintaining aspect ratio */
    preview?: Dimensions;
    /** Resize the image to specified dimensions */
    resize?: Dimensions | `${number | string}x` | `x${number | string}`;
    /** Control how the image fits into the specified dimensions */
    stretch?: "on" | "off" | "fill";
    /** Resize the image intelligently to fit the specified dimensions */
    smart_resize?: Dimensions;
    /** Crop the image to specified dimensions */
    crop?: string;
    /** Scale and crop the image to specified dimensions */
    scale_crop?: string;
    /** Apply border radius to the image */
    border_radius?: string;
    /** Set the background color for transparent images */
    setfill?: string;
    /** Zoom in on detected objects in the image */
    zoom_objects?: number;
    /** Automatically rotate the image based on EXIF data */
    autorotate?: "yes" | "no";
    /** Rotate the image by a specified number of degrees */
    rotate?: number;
    /** Flip the image vertically */
    flip?: boolean;
    /** Mirror the image horizontally */
    mirror?: boolean;
    /** Set the quality of the output image */
    quality?: "normal" | "better" | "best" | "lighter" | "lightest";
    /** Enable or disable progressive image loading */
    progressive?: "yes" | "no";
    /** Control the removal of metadata from the image */
    strip_meta?: "all" | "none" | "sensitive";
}
export interface UploadcareOptions {
    /** The hostname for the Uploadcare CDN */
    host?: string;
}
export declare const extract: URLExtractor<"uploadcare">;
export declare const generate: URLGenerator<"uploadcare">;
export declare const transform: URLTransformer<"uploadcare">;
export {};
//# sourceMappingURL=uploadcare.d.ts.map