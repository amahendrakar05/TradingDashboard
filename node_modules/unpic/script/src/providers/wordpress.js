"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.transform = exports.extract = exports.generate = void 0;
const utils_js_1 = require("../utils.js");
const { operationsGenerator, operationsParser } = (0, utils_js_1.createOperationsHandlers)({
    keyMap: {
        width: "w",
        height: "h",
    },
    defaults: {
        crop: "1",
    },
});
const generate = (src, operations) => {
    const url = (0, utils_js_1.toUrl)(src);
    const { crop } = operations;
    if (typeof crop !== "undefined" && crop !== "0") {
        operations.crop = crop ? "1" : "0";
    }
    url.search = operationsGenerator(operations);
    return (0, utils_js_1.toCanonicalUrlString)(url);
};
exports.generate = generate;
const extract = (url) => {
    const parsedUrl = (0, utils_js_1.toUrl)(url);
    const operations = operationsParser(parsedUrl);
    if (operations.crop !== undefined) {
        operations.crop = operations.crop === "1";
    }
    parsedUrl.search = "";
    return {
        src: (0, utils_js_1.toCanonicalUrlString)(parsedUrl),
        operations,
    };
};
exports.extract = extract;
exports.transform = (0, utils_js_1.createExtractAndGenerate)(exports.extract, exports.generate);
