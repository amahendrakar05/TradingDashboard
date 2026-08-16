import { createExtractAndGenerate, createOperationsGenerator, extractFromURL, toCanonicalUrlString, toUrl, } from "../utils.js";
const operationsGenerator = createOperationsGenerator({
    defaults: {
        withoutEnlargement: true,
        fit: "cover",
    },
});
export const generate = (src, operations) => {
    if (Array.isArray(operations.transforms)) {
        operations.transforms = JSON.stringify(operations.transforms);
    }
    const modifiers = operationsGenerator(operations);
    const url = toUrl(src);
    url.search = modifiers;
    return toCanonicalUrlString(url);
};
export const extract = (url) => {
    const base = extractFromURL(url);
    if (base?.operations?.transforms &&
        typeof base.operations.transforms === "string") {
        try {
            base.operations.transforms = JSON.parse(base.operations.transforms);
        }
        catch {
            return null;
        }
    }
    return base;
};
export const transform = createExtractAndGenerate(extract, generate);
