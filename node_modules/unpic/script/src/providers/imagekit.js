"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.transform = exports.extract = exports.generate = void 0;
const utils_js_1 = require("../utils.js");
const { operationsGenerator, operationsParser } = (0, utils_js_1.createOperationsHandlers)({
    keyMap: {
        width: "w",
        height: "h",
        format: "f",
        quality: "q",
    },
    defaults: {
        c: "maintain_ratio",
        fo: "auto",
    },
    kvSeparator: "-",
    paramSeparator: ",",
});
const generate = (src, operations) => {
    const modifiers = operationsGenerator(operations);
    const url = (0, utils_js_1.toUrl)(src);
    url.searchParams.set("tr", modifiers);
    return (0, utils_js_1.toCanonicalUrlString)(url);
};
exports.generate = generate;
const extract = (url) => {
    const parsedUrl = (0, utils_js_1.toUrl)(url);
    let trPart = null;
    let path = parsedUrl.pathname;
    // Check for query parameter format
    if (parsedUrl.searchParams.has("tr")) {
        trPart = parsedUrl.searchParams.get("tr");
        parsedUrl.searchParams.delete("tr");
    }
    else {
        // Check for path-based format
        const pathParts = parsedUrl.pathname.split("/");
        const trIndex = pathParts.findIndex((part) => part.startsWith("tr:"));
        if (trIndex !== -1) {
            trPart = pathParts[trIndex].slice(3); // Remove 'tr:' prefix
            path = pathParts.slice(0, trIndex).concat(pathParts.slice(trIndex + 1)).join("/");
        }
    }
    if (!trPart) {
        return null;
    }
    parsedUrl.pathname = path;
    const operations = operationsParser(trPart);
    return {
        src: (0, utils_js_1.toCanonicalUrlString)(parsedUrl),
        operations,
    };
};
exports.extract = extract;
exports.transform = (0, utils_js_1.createExtractAndGenerate)(exports.extract, exports.generate);
