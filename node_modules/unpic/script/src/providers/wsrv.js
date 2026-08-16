"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.transform = exports.generate = exports.extract = void 0;
const utils_js_1 = require("../utils.js");
const { operationsGenerator, operationsParser } = (0, utils_js_1.createOperationsHandlers)({
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
const extract = (url) => {
    const urlObj = (0, utils_js_1.toUrl)(url);
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
exports.extract = extract;
const generate = (src, operations) => {
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
    return (0, utils_js_1.toCanonicalUrlString)(url);
};
exports.generate = generate;
exports.transform = (0, utils_js_1.createExtractAndGenerate)(exports.extract, exports.generate);
