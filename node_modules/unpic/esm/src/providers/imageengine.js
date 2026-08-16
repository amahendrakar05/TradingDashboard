import { createExtractAndGenerate, createOperationsHandlers, toCanonicalUrlString, toUrl, } from "../utils.js";
const { operationsGenerator, operationsParser } = createOperationsHandlers({
    keyMap: {
        width: "w",
        height: "h",
        format: "f",
    },
    defaults: {
        m: "cropbox",
    },
    kvSeparator: "_",
    paramSeparator: "/",
});
export const generate = (src, operations) => {
    const modifiers = operationsGenerator(operations);
    const url = toUrl(src);
    url.searchParams.set("imgeng", modifiers);
    return toCanonicalUrlString(url);
};
export const extract = (url) => {
    const parsedUrl = toUrl(url);
    const imgeng = parsedUrl.searchParams.get("imgeng");
    if (!imgeng) {
        return null;
    }
    const operations = operationsParser(imgeng);
    parsedUrl.searchParams.delete("imgeng");
    return {
        src: toCanonicalUrlString(parsedUrl),
        operations,
    };
};
export const transform = createExtractAndGenerate(extract, generate);
