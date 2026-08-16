import { createExtractAndGenerate, createOperationsHandlers, toCanonicalUrlString, toUrl, } from "../utils.js";
const { operationsGenerator, operationsParser } = createOperationsHandlers({
    keyMap: {
        format: "fm",
        width: "w",
        height: "h",
        quality: "q",
    },
    defaults: {
        fit: "min",
        auto: "format",
    },
});
export const extract = (url) => {
    const src = toUrl(url);
    const operations = operationsParser(url);
    src.search = "";
    return { src: toCanonicalUrlString(src), operations };
};
export const generate = (src, operations) => {
    const modifiers = operationsGenerator(operations);
    const url = toUrl(src);
    url.search = modifiers;
    if (url.searchParams.has("fm") && url.searchParams.get("auto") === "format") {
        url.searchParams.delete("auto");
    }
    return toCanonicalUrlString(url);
};
export const transform = createExtractAndGenerate(extract, generate);
