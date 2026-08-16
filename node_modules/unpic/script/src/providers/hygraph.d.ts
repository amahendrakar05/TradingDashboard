import type { Operations, URLExtractor, URLGenerator, URLTransformer } from "../types.js";
export interface HygraphOperations extends Operations {
    /**
     * Fit mode for resizing.
     */
    fit?: "crop" | "clip" | "scale" | "max";
}
export interface HygraphOptions {
    region?: string;
    envId?: string;
    handle?: string;
}
export declare const extract: URLExtractor<"hygraph">;
export declare const generate: URLGenerator<"hygraph">;
export declare const transform: URLTransformer<"hygraph">;
//# sourceMappingURL=hygraph.d.ts.map