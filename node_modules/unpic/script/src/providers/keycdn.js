"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.transform = exports.extract = exports.generate = void 0;
const utils_js_1 = require("../utils.js");
const BOOLEAN_PARAMS = [
    "enlarge",
    "flip",
    "flop",
    "negate",
    "normalize",
    "grayscale",
    "removealpha",
    "olrepeat",
    "progressive",
    "adaptive",
    "lossless",
    "nearlossless",
    "metadata",
];
const { operationsGenerator, operationsParser } = (0, utils_js_1.createOperationsHandlers)({
    defaults: {
        fit: "cover",
    },
    formatMap: {
        jpg: "jpeg",
    },
});
const generate = (src, operations) => {
    const url = (0, utils_js_1.toUrl)(src);
    for (const key of BOOLEAN_PARAMS) {
        if (operations[key] !== undefined) {
            operations[key] = operations[key] ? 1 : 0;
        }
    }
    url.search = operationsGenerator(operations);
    return (0, utils_js_1.toCanonicalUrlString)(url);
};
exports.generate = generate;
const extract = (url) => {
    const parsedUrl = (0, utils_js_1.toUrl)(url);
    const operations = operationsParser(parsedUrl);
    for (const key of BOOLEAN_PARAMS) {
        if (operations[key] !== undefined) {
            operations[key] = (0, utils_js_1.paramToBoolean)(operations[key]);
        }
    }
    parsedUrl.search = "";
    return {
        src: (0, utils_js_1.toCanonicalUrlString)(parsedUrl),
        operations,
    };
};
exports.extract = extract;
exports.transform = (0, utils_js_1.createExtractAndGenerate)(exports.extract, exports.generate);
