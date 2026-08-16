"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.transform = exports.generate = exports.extract = void 0;
const utils_js_1 = require("../utils.js");
const { operationsGenerator, operationsParser } = (0, utils_js_1.createOperationsHandlers)({
    keyMap: {
        format: "fm",
        width: "w",
        height: "h",
        quality: "q",
    },
    defaults: {
        fit: "min",
        auto: "format",
    },
});
const extract = (url) => {
    const src = (0, utils_js_1.toUrl)(url);
    const operations = operationsParser(url);
    src.search = "";
    return { src: (0, utils_js_1.toCanonicalUrlString)(src), operations };
};
exports.extract = extract;
const generate = (src, operations) => {
    const modifiers = operationsGenerator(operations);
    const url = (0, utils_js_1.toUrl)(src);
    url.search = modifiers;
    if (url.searchParams.has("fm") && url.searchParams.get("auto") === "format") {
        url.searchParams.delete("auto");
    }
    return (0, utils_js_1.toCanonicalUrlString)(url);
};
exports.generate = generate;
exports.transform = (0, utils_js_1.createExtractAndGenerate)(exports.extract, exports.generate);
