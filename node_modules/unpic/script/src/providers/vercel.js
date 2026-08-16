"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.transform = exports.extract = exports.generate = void 0;
const detect_js_1 = require("../detect.js");
const utils_js_1 = require("../utils.js");
const { operationsGenerator, operationsParser } = (0, utils_js_1.createOperationsHandlers)({
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
const generate = (src, operations, options = {}) => {
    const url = (0, utils_js_1.toUrl)(`${options.baseUrl || ""}/${options.prefix || "_vercel"}/image`);
    url.search = operationsGenerator(operations);
    url.searchParams.append("url", src.toString());
    return (0, utils_js_1.toCanonicalUrlString)(url);
};
exports.generate = generate;
const extract = (url, options = {}) => {
    if (!["vercel", "nextjs"].includes((0, detect_js_1.getProviderForUrlByPath)(url) || "")) {
        return null;
    }
    const parsedUrl = (0, utils_js_1.toUrl)(url);
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
exports.extract = extract;
exports.transform = (0, utils_js_1.createExtractAndGenerate)(exports.extract, exports.generate);
