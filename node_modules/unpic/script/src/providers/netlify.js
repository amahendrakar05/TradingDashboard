"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.transform = exports.extract = exports.generate = void 0;
const detect_js_1 = require("../detect.js");
const utils_js_1 = require("../utils.js");
const { operationsGenerator, operationsParser } = (0, utils_js_1.createOperationsHandlers)({
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
const generate = (src, operations, options = {}) => {
    const url = (0, utils_js_1.toUrl)(`${options.baseUrl || ""}/.netlify/images`);
    url.search = operationsGenerator(operations);
    url.searchParams.set("url", src.toString());
    return (0, utils_js_1.toCanonicalUrlString)(url);
};
exports.generate = generate;
const extract = (url) => {
    if ((0, detect_js_1.getProviderForUrlByPath)(url) !== "netlify") {
        return null;
    }
    const parsedUrl = (0, utils_js_1.toUrl)(url);
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
exports.extract = extract;
exports.transform = (0, utils_js_1.createExtractAndGenerate)(exports.extract, exports.generate);
