"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.transform = exports.extract = exports.generate = void 0;
const detect_js_1 = require("../detect.js");
const utils_js_1 = require("../utils.js");
const { operationsGenerator, operationsParser } = (0, utils_js_1.createOperationsHandlers)({
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
const generate = (src, operations) => {
    const url = new URL(src, BASE);
    url.search = operationsGenerator(operations);
    return (0, utils_js_1.toCanonicalUrlString)(url);
};
exports.generate = generate;
const extract = (url) => {
    if ((0, detect_js_1.getProviderForUrl)(url) !== "scene7") {
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
exports.extract = extract;
exports.transform = (0, utils_js_1.createExtractAndGenerate)(exports.extract, exports.generate);
