import { getProviderForUrl } from "../detect.js";
import { createExtractAndGenerate, createOperationsHandlers, toCanonicalUrlString, } from "../utils.js";
const { operationsGenerator, operationsParser } = createOperationsHandlers({
    keyMap: {
        width: "wid",
        height: "hei",
        quality: "qlt",
        format: "fmt",
    },
    defaults: {
        fit: "crop,0",
    },
});
const BASE = "https://s7d1.scene7.com/is/image/";
export const generate = (src, operations) => {
    const url = new URL(src, BASE);
    url.search = operationsGenerator(operations);
    return toCanonicalUrlString(url);
};
export const extract = (url) => {
    if (getProviderForUrl(url) !== "scene7") {
        return null;
    }
    const parsedUrl = new URL(url, BASE);
    const operations = operationsParser(parsedUrl);
    parsedUrl.search = "";
    return {
        src: parsedUrl.toString(),
        operations,
    };
};
export const transform = createExtractAndGenerate(extract, generate);
