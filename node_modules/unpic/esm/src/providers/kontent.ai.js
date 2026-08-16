import { createExtractAndGenerate, createOperationsHandlers, paramToBoolean, toCanonicalUrlString, toUrl, } from "../utils.js";
const { operationsGenerator, operationsParser } = createOperationsHandlers({
    formatMap: {
        jpg: "jpeg",
    },
    keyMap: {
        format: "fm",
        width: "w",
        height: "h",
        quality: "q",
    },
});
export const generate = (src, operations) => {
    const url = toUrl(src);
    if (operations.lossless !== undefined) {
        operations.lossless = operations.lossless ? 1 : 0;
    }
    if (operations.width && operations.height) {
        operations.fit = "crop";
    }
    url.search = operationsGenerator(operations);
    return toCanonicalUrlString(url);
};
export const extract = (url) => {
    const parsedUrl = toUrl(url);
    const operations = operationsParser(parsedUrl);
    if (operations.lossless !== undefined) {
        operations.lossless = paramToBoolean(operations.lossless);
    }
    parsedUrl.search = "";
    return {
        src: toCanonicalUrlString(parsedUrl),
        operations,
    };
};
export const transform = createExtractAndGenerate(extract, generate);
