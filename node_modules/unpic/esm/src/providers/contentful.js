import { clampDimensions, createExtractAndGenerate, createOperationsGenerator, extractFromURL, toCanonicalUrlString, } from "../utils.js";
const operationsGenerator = createOperationsGenerator({
    keyMap: {
        format: "fm",
        width: "w",
        height: "h",
        quality: "q",
    },
    defaults: {
        fit: "fill",
    },
});
export const generate = (src, modifiers) => {
    const operations = operationsGenerator(modifiers);
    const url = new URL(src);
    url.search = operations;
    return toCanonicalUrlString(url);
};
export const extract = extractFromURL;
const extractAndGenerate = createExtractAndGenerate(extract, generate);
export const transform = (src, operations) => {
    const { width, height } = clampDimensions(operations, 4000, 4000);
    return extractAndGenerate(src, {
        ...operations,
        width,
        height,
    });
};
