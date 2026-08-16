"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.transform = exports.extract = exports.generate = void 0;
const utils_js_1 = require("../utils.js");
const operationsGenerator = (0, utils_js_1.createOperationsGenerator)({
    defaults: {
        withoutEnlargement: true,
        fit: "cover",
    },
});
const generate = (src, operations) => {
    if (Array.isArray(operations.transforms)) {
        operations.transforms = JSON.stringify(operations.transforms);
    }
    const modifiers = operationsGenerator(operations);
    const url = (0, utils_js_1.toUrl)(src);
    url.search = modifiers;
    return (0, utils_js_1.toCanonicalUrlString)(url);
};
exports.generate = generate;
const extract = (url) => {
    const base = (0, utils_js_1.extractFromURL)(url);
    if (base?.operations?.transforms &&
        typeof base.operations.transforms === "string") {
        try {
            base.operations.transforms = JSON.parse(base.operations.transforms);
        }
        catch {
            return null;
        }
    }
    return base;
};
exports.extract = extract;
exports.transform = (0, utils_js_1.createExtractAndGenerate)(exports.extract, exports.generate);
