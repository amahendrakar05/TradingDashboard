import { getProviderForUrlByPath } from "../detect.js";
import { createExtractAndGenerate, createOperationsHandlers, toCanonicalUrlString, toUrl, } from "../utils.js";
const { operationsGenerator, operationsParser } = createOperationsHandlers({
    defaults: {
        fit: "cover",
    },
    keyMap: {
        format: "fm",
        width: "w",
        height: "h",
        quality: "q",
    },
});
export const generate = (src, operations, options = {}) => {
    const url = toUrl(`${options.baseUrl || ""}/.netlify/images`);
    url.search = operationsGenerator(operations);
    url.searchParams.set("url", src.toString());
    return toCanonicalUrlString(url);
};
export const extract = (url) => {
    if (getProviderForUrlByPath(url) !== "netlify") {
        return null;
    }
    const parsedUrl = toUrl(url);
    const operations = operationsParser(parsedUrl);
    // deno-lint-ignore no-explicit-any
    delete operations.url;
    const sourceUrl = parsedUrl.searchParams.get("url") || "";
    parsedUrl.search = "";
    return {
        src: sourceUrl,
        operations,
        options: {
            baseUrl: parsedUrl.hostname === "n" ? undefined : parsedUrl.origin,
        },
    };
};
export const transform = createExtractAndGenerate(extract, generate);
