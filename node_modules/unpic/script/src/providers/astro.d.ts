import type { ImageFormat, Operations, URLExtractor, URLGenerator, URLTransformer } from "../types.js";
export interface AstroOperations extends Operations {
    w?: number;
    h?: number;
    f?: ImageFormat;
    q?: number;
    fit?: "contain" | "cover" | "fill" | "none" | "scale-down";
}
export interface AstroOptions {
    baseUrl?: string;
    endpoint?: string;
}
export declare const generate: URLGenerator<"astro">;
export declare const extract: URLExtractor<"astro">;
export declare const transform: URLTransformer<"astro">;
//# sourceMappingURL=astro.d.ts.map