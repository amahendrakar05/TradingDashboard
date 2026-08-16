import { createExtractAndGenerate, createOperationsHandlers, toCanonicalUrlString, toUrl, } from "../utils.js";
const { operationsGenerator, operationsParser } = createOperationsHandlers({
    keyMap: {
        width: "w",
        height: "h",
        format: "f",
        quality: "q",
    },
    defaults: {
        c: "maintain_ratio",
        fo: "auto",
    },
    kvSeparator: "-",
    paramSeparator: ",",
});
export const generate = (src, operations) => {
    const modifiers = operationsGenerator(operations);
    const url = toUrl(src);
    url.searchParams.set("tr", modifiers);
    return toCanonicalUrlString(url);
};
export const extract = (url) => {
    const parsedUrl = toUrl(url);
    let trPart = null;
    let path = parsedUrl.pathname;
    // Check for query parameter format
    if (parsedUrl.searchParams.has("tr")) {
        trPart = parsedUrl.searchParams.get("tr");
        parsedUrl.searchParams.delete("tr");
    }
    else {
        // Check for path-based format
        const pathParts = parsedUrl.pathname.split("/");
        const trIndex = pathParts.findIndex((part) => part.startsWith("tr:"));
        if (trIndex !== -1) {
            trPart = pathParts[trIndex].slice(3); // Remove 'tr:' prefix
            path = pathParts.slice(0, trIndex).concat(pathParts.slice(trIndex + 1)).join("/");
        }
    }
    if (!trPart) {
        return null;
    }
    parsedUrl.pathname = path;
    const operations = operationsParser(trPart);
    return {
        src: toCanonicalUrlString(parsedUrl),
        operations,
    };
};
export const transform = createExtractAndGenerate(extract, generate);
