import { createExtractAndGenerate, createOperationsHandlers, paramToBoolean, toCanonicalUrlString, toUrl, } from "../utils.js";
const BOOLEAN_PARAMS = [
    "enlarge",
    "flip",
    "flop",
    "negate",
    "normalize",
    "grayscale",
    "removealpha",
    "olrepeat",
    "progressive",
    "adaptive",
    "lossless",
    "nearlossless",
    "metadata",
];
const { operationsGenerator, operationsParser } = createOperationsHandlers({
    defaults: {
        fit: "cover",
    },
    formatMap: {
        jpg: "jpeg",
    },
});
export const generate = (src, operations) => {
    const url = toUrl(src);
    for (const key of BOOLEAN_PARAMS) {
        if (operations[key] !== undefined) {
            operations[key] = operations[key] ? 1 : 0;
        }
    }
    url.search = operationsGenerator(operations);
    return toCanonicalUrlString(url);
};
export const extract = (url) => {
    const parsedUrl = toUrl(url);
    const operations = operationsParser(parsedUrl);
    for (const key of BOOLEAN_PARAMS) {
        if (operations[key] !== undefined) {
            operations[key] = paramToBoolean(operations[key]);
        }
    }
    parsedUrl.search = "";
    return {
        src: toCanonicalUrlString(parsedUrl),
        operations,
    };
};
export const transform = createExtractAndGenerate(extract, generate);
