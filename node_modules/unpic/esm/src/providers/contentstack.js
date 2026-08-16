import { createExtractAndGenerate, createOperationsGenerator, extractFromURL, toCanonicalUrlString, toUrl, } from "../utils.js";
const operationsGenerator = createOperationsGenerator({
    defaults: {
        auto: "webp",
        disable: "upscale",
    },
});
export const generate = (src, operations, { baseURL = "https://images.contentstack.io/" } = {}) => {
    if (operations.width && operations.height) {
        operations.fit ??= "crop";
    }
    const modifiers = operationsGenerator(operations);
    const url = toUrl(src);
    if (url.hostname === "n") {
        url.protocol = "https:";
        url.hostname = new URL(baseURL).hostname;
    }
    url.search = modifiers;
    return toCanonicalUrlString(url);
};
export const extract = (url) => {
    const { src, operations } = extractFromURL(url) ?? {};
    if (!operations || !src) {
        return null;
    }
    const { origin } = toUrl(url);
    return {
        src,
        operations: operations,
        options: {
            baseURL: origin,
        },
    };
};
export const transform = createExtractAndGenerate(extract, generate);
