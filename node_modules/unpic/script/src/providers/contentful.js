"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.transform = exports.extract = exports.generate = void 0;
const utils_js_1 = require("../utils.js");
const operationsGenerator = (0, utils_js_1.createOperationsGenerator)({
    keyMap: {
        format: "fm",
        width: "w",
        height: "h",
        quality: "q",
    },
    defaults: {
        fit: "fill",
    },
});
const generate = (src, modifiers) => {
    const operations = operationsGenerator(modifiers);
    const url = new URL(src);
    url.search = operations;
    return (0, utils_js_1.toCanonicalUrlString)(url);
};
exports.generate = generate;
exports.extract = utils_js_1.extractFromURL;
const extractAndGenerate = (0, utils_js_1.createExtractAndGenerate)(exports.extract, exports.generate);
const transform = (src, operations) => {
    const { width, height } = (0, utils_js_1.clampDimensions)(operations, 4000, 4000);
    return extractAndGenerate(src, {
        ...operations,
        width,
        height,
    });
};
exports.transform = transform;
