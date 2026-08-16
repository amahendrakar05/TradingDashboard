import { createExtractAndGenerate, createOperationsHandlers, toCanonicalUrlString, toUrl, } from "../utils.js";
const { operationsGenerator, operationsParser } = createOperationsHandlers({
    keyMap: {
        width: "w",
        height: "h",
        format: "output",
        quality: "q",
    },
    defaults: {
        fit: "cover",
    },
});
export const extract = (url) => {
    const urlObj = toUrl(url);
    const srcParam = urlObj.searchParams.get("url");
    if (!srcParam) {
        return null;
    }
    let src = srcParam;
    if (!src.startsWith("http://") && !src.startsWith("https://")) {
        src = "https://" + src;
    }
    urlObj.searchParams.delete("url");
    const operations = operationsParser(urlObj);
    return {
        src,
        operations,
    };
};
export const generate = (src, operations) => {
    const url = new URL("https://wsrv.nl/");
    const srcUrl = typeof src === "string" ? src : src.toString();
    const cleanSrc = srcUrl.replace(/^https?:\/\//, "");
    url.searchParams.set("url", cleanSrc);
    const params = operationsGenerator(operations);
    const searchParams = new URLSearchParams(params);
    for (const [key, value] of searchParams) {
        if (key !== "url") {
            url.searchParams.set(key, value);
        }
    }
    return toCanonicalUrlString(url);
};
export const transform = createExtractAndGenerate(extract, generate);
