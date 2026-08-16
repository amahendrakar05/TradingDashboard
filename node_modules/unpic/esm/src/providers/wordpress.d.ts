import type { Operations, URLExtractor, URLGenerator, URLTransformer } from "../types.js";
export interface WordPressOperations extends Operations {
    w?: number;
    h?: number;
    crop?: boolean | "1" | "0";
}
export declare const generate: URLGenerator<"wordpress">;
export declare const extract: URLExtractor<"wordpress">;
export declare const transform: URLTransformer<"wordpress">;
//# sourceMappingURL=wordpress.d.ts.map