import { type VercelOperations as NextjsOperations } from "./vercel.js";
import type { URLExtractor, URLGenerator, URLTransformer } from "../types.js";
export type { NextjsOperations };
export interface NextjsOptions {
    baseUrl?: string;
}
export declare const generate: URLGenerator<"nextjs">;
export declare const extract: URLExtractor<"nextjs">;
export declare const transform: URLTransformer<"nextjs">;
//# sourceMappingURL=nextjs.d.ts.map