import { Operations, URLExtractor, URLGenerator, type URLTransformer } from "../types.js";
/**
 * @see https://docs.directus.io/reference/files.html#custom-transformations
 */
export interface DirectusOperations extends Operations<"auto"> {
    fit?: "cover" | "contain" | "inside" | "outside";
    withoutEnlargement?: boolean;
    /**
     * For advanced control over the file generation, Directus exposes the
     * [full `sharp` API](https://sharp.pixelplumbing.com/api-operation).
     * Pass an array of operations to apply to the image, or a JSON string.
     */
    transforms?: Array<[
        operation: string,
        ...Array<string | number | boolean>
    ]> | string;
}
export declare const generate: URLGenerator<"directus">;
export declare const extract: URLExtractor<"directus">;
export declare const transform: URLTransformer<"directus">;
//# sourceMappingURL=directus.d.ts.map