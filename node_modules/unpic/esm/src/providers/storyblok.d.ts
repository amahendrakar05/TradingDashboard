import type { Operations, URLExtractor, URLGenerator, URLTransformer } from "../types.js";
export interface StoryblokOperations extends Operations {
    crop?: string;
    filters?: Record<string, string>;
    flipx?: "-";
    flipy?: "-";
}
export declare const extract: URLExtractor<"storyblok">;
export declare const generate: URLGenerator<"storyblok">;
export declare const transform: URLTransformer<"storyblok">;
//# sourceMappingURL=storyblok.d.ts.map