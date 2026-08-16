"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.transform = exports.generate = exports.extract = void 0;
const utils_js_1 = require("../utils.js");
const operationsGenerator = (0, utils_js_1.createOperationsGenerator)({
    defaults: {
        fit: "cover",
        format: "webp",
        sharp: true,
    },
});
exports.extract = utils_js_1.extractFromURL;
const generate = (src, modifiers) => {
    const operations = operationsGenerator(modifiers);
    const url = (0, utils_js_1.toUrl)(src);
    url.search = operations;
    return (0, utils_js_1.toCanonicalUrlString)(url);
};
exports.generate = generate;
exports.transform = (0, utils_js_1.createExtractAndGenerate)(exports.extract, exports.generate);
