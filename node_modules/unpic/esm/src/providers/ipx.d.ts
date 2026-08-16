import { ImageFormat, Operations, URLExtractor, URLGenerator, URLTransformer } from "../types.js";
export interface IPXOperations extends Operations {
    /**
     * Width of the image in pixels.
     */
    w?: number;
    /**
     * Height of the image in pixels.
     */
    h?: number;
    /**
     * Combined size parameter. Example: "300x200"
     */
    s?: string;
    /**
     * Quality of the image (1-100).
     */
    q?: number;
    /**
     * Output format of the image.
     */
    f?: ImageFormat | "auto";
}
export interface IPXOptions {
    baseURL?: string;
}
export declare const generate: URLGenerator<"ipx">;
export declare const extract: URLExtractor<"ipx">;
export declare const transform: URLTransformer<"ipx">;
//# sourceMappingURL=ipx.d.ts.map