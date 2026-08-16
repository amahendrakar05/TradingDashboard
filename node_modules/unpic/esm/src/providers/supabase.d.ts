import type { Operations, URLExtractor, URLGenerator, URLTransformer } from "../types.js";
/**
 * Supabase Image Transformation API operations
 */
export interface SupabaseOperations extends Operations<"origin"> {
    /**
     * You can use different resizing modes:
     * - `cover`: resizes the image while keeping the aspect ratio to fill a given size and crops projecting parts.
     * - `contain`: resizes the image while keeping the aspect ratio to fit a given size.
     * - `fill`: resizes the image without keeping the aspect ratio.
     */
    resize?: "cover" | "contain" | "fill";
    /**
     * When using the image transformation API, Storage will automatically find the best format supported
     * by the client and return that to the client.
     * In case you'd like to return the original format of the image and opt-out from the automatic image
     * optimization detection, you can pass the format=origin parameter when requesting a transformed image
     */
    format?: "origin";
}
export declare const generate: URLGenerator<"supabase">;
export declare const extract: URLExtractor<"supabase">;
export declare const transform: URLTransformer<"supabase">;
//# sourceMappingURL=supabase.d.ts.map