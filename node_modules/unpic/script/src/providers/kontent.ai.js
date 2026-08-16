"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.transform = exports.extract = exports.generate = void 0;
const utils_js_1 = require("../utils.js");
const { operationsGenerator, operationsParser } = (0, utils_js_1.createOperationsHandlers)({
    formatMap: {
        jpg: "jpeg",
    },
    keyMap: {
        format: "fm",
        width: "w",
        height: "h",
        quality: "q",
    },
});
const generate = (src, operations) => {
    const url = (0, utils_js_1.toUrl)(src);
    if (operations.lossless !== undefined) {
        operations.lossless = operations.lossless ? 1 : 0;
    }
    if (operations.width && operations.height) {
        operations.fit = "crop";
    }
    url.search = operationsGenerator(operations);
    return (0, utils_js_1.toCanonicalUrlString)(url);
};
exports.generate = generate;
const extract = (url) => {
    const parsedUrl = (0, utils_js_1.toUrl)(url);
    const operations = operationsParser(parsedUrl);
    if (operations.lossless !== undefined) {
        operations.lossless = (0, utils_js_1.paramToBoolean)(operations.lossless);
    }
    parsedUrl.search = "";
    return {
        src: (0, utils_js_1.toCanonicalUrlString)(parsedUrl),
        operations,
    };
};
exports.extract = extract;
exports.transform = (0, utils_js_1.createExtractAndGenerate)(exports.extract, exports.generate);
