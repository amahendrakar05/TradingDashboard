"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.transform = exports.extract = exports.generate = void 0;
const utils_js_1 = require("../utils.js");
const { operationsGenerator, operationsParser } = (0, utils_js_1.createOperationsHandlers)({
    keyMap: {
        width: "w",
        height: "h",
        format: "f",
    },
    defaults: {
        m: "cropbox",
    },
    kvSeparator: "_",
    paramSeparator: "/",
});
const generate = (src, operations) => {
    const modifiers = operationsGenerator(operations);
    const url = (0, utils_js_1.toUrl)(src);
    url.searchParams.set("imgeng", modifiers);
    return (0, utils_js_1.toCanonicalUrlString)(url);
};
exports.generate = generate;
const extract = (url) => {
    const parsedUrl = (0, utils_js_1.toUrl)(url);
    const imgeng = parsedUrl.searchParams.get("imgeng");
    if (!imgeng) {
        return null;
    }
    const operations = operationsParser(imgeng);
    parsedUrl.searchParams.delete("imgeng");
    return {
        src: (0, utils_js_1.toCanonicalUrlString)(parsedUrl),
        operations,
    };
};
exports.extract = extract;
exports.transform = (0, utils_js_1.createExtractAndGenerate)(exports.extract, exports.generate);
