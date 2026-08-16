"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.transform = exports.extract = exports.generate = void 0;
const utils_js_1 = require("../utils.js");
const operationsGenerator = (0, utils_js_1.createOperationsGenerator)({
    defaults: {
        auto: "webp",
        disable: "upscale",
    },
});
const generate = (src, operations, { baseURL = "https://images.contentstack.io/" } = {}) => {
    if (operations.width && operations.height) {
        operations.fit ??= "crop";
    }
    const modifiers = operationsGenerator(operations);
    const url = (0, utils_js_1.toUrl)(src);
    if (url.hostname === "n") {
        url.protocol = "https:";
        url.hostname = new URL(baseURL).hostname;
    }
    url.search = modifiers;
    return (0, utils_js_1.toCanonicalUrlString)(url);
};
exports.generate = generate;
const extract = (url) => {
    const { src, operations } = (0, utils_js_1.extractFromURL)(url) ?? {};
    if (!operations || !src) {
        return null;
    }
    const { origin } = (0, utils_js_1.toUrl)(url);
    return {
        src,
        operations: operations,
        options: {
            baseURL: origin,
        },
    };
};
exports.extract = extract;
exports.transform = (0, utils_js_1.createExtractAndGenerate)(exports.extract, exports.generate);
