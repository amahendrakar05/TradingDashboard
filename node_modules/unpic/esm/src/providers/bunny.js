import { createExtractAndGenerate, createOperationsGenerator, extractFromURL, toCanonicalUrlString, toUrl, } from "../utils.js";
const operationsGenerator = createOperationsGenerator({
    keyMap: {
        format: "output",
    },
});
export const extract = extractFromURL;
export const generate = (src, modifiers) => {
    const operations = operationsGenerator(modifiers);
    const url = toUrl(src);
    url.search = operations;
    return toCanonicalUrlString(url);
};
const extractAndGenerate = createExtractAndGenerate(extract, generate);
export const transform = (src, operations) => {
    const { width, height } = operations;
    if (width && height) {
        operations.aspect_ratio ??= `${Math.round(Number(width))}:${Math.round(Number(height))}`;
    }
    return extractAndGenerate(src, operations);
};
