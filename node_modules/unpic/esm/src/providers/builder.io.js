import { createExtractAndGenerate, createOperationsGenerator, extractFromURL, toCanonicalUrlString, toUrl, } from "../utils.js";
const operationsGenerator = createOperationsGenerator({
    defaults: {
        fit: "cover",
        format: "webp",
        sharp: true,
    },
});
export const extract = extractFromURL;
export const generate = (src, modifiers) => {
    const operations = operationsGenerator(modifiers);
    const url = toUrl(src);
    url.search = operations;
    return toCanonicalUrlString(url);
};
export const transform = createExtractAndGenerate(extract, generate);
