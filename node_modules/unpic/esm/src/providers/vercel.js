import { getProviderForUrlByPath } from "../detect.js";
import { createExtractAndGenerate, createOperationsHandlers, toCanonicalUrlString, toUrl, } from "../utils.js";
const { operationsGenerator, operationsParser } = createOperationsHandlers({
    keyMap: {
        width: "w",
        quality: "q",
        height: false,
        format: false,
    },
    defaults: {
        q: 75,
    },
});
export const generate = (src, operations, options = {}) => {
    const url = toUrl(`${options.baseUrl || ""}/${options.prefix || "_vercel"}/image`);
    url.search = operationsGenerator(operations);
    url.searchParams.append("url", src.toString());
    return toCanonicalUrlString(url);
};
export const extract = (url, options = {}) => {
    if (!["vercel", "nextjs"].includes(getProviderForUrlByPath(url) || "")) {
        return null;
    }
    const parsedUrl = toUrl(url);
    const sourceUrl = parsedUrl.searchParams.get("url") || "";
    parsedUrl.searchParams.delete("url");
    const operations = operationsParser(parsedUrl);
    parsedUrl.search = "";
    return {
        src: sourceUrl,
        operations,
        options: {
            baseUrl: options.baseUrl ?? parsedUrl.origin,
        },
    };
};
export const transform = createExtractAndGenerate(extract, generate);
