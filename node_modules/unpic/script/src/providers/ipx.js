"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.transform = exports.extract = exports.generate = void 0;
const utils_js_1 = require("../utils.js");
const { operationsGenerator, operationsParser } = (0, utils_js_1.createOperationsHandlers)({
    keyMap: {
        width: "w",
        height: "h",
        quality: "q",
        format: "f",
    },
    defaults: {
        f: "auto",
    },
    kvSeparator: "_",
    paramSeparator: ",",
});
const generate = (src, operations, options) => {
    if (operations.width && operations.height) {
        operations.s = `${operations.width}x${operations.height}`;
        delete operations.width;
        delete operations.height;
    }
    const modifiers = operationsGenerator(operations);
    const baseURL = options?.baseURL ?? "/_ipx";
    const url = (0, utils_js_1.toUrl)(baseURL);
    url.pathname = `${(0, utils_js_1.stripTrailingSlash)(url.pathname)}/${modifiers}/${(0, utils_js_1.stripLeadingSlash)(src.toString())}`;
    return (0, utils_js_1.toCanonicalUrlString)(url);
};
exports.generate = generate;
const extract = (url) => {
    const parsedUrl = (0, utils_js_1.toUrl)(url);
    const [, baseUrlPart, modifiers, ...srcParts] = parsedUrl.pathname.split("/");
    if (!modifiers || !srcParts.length) {
        return null;
    }
    const operations = operationsParser(modifiers);
    // Handle the 's' parameter
    if (operations.s) {
        const [width, height] = operations.s.split("x").map(Number);
        operations.width = width;
        operations.height = height;
        delete operations.s;
    }
    return {
        src: "/" + srcParts.join("/"),
        operations,
        options: {
            baseURL: `${parsedUrl.origin}/${baseUrlPart}`,
        },
    };
};
exports.extract = extract;
const transform = (src, operations, options) => {
    const url = (0, utils_js_1.toUrl)(src);
    const baseURL = options?.baseURL;
    if ((baseURL && url.toString().startsWith(baseURL)) ||
        url.pathname.startsWith("/_ipx")) {
        const extracted = (0, exports.extract)(src);
        if (extracted) {
            return (0, exports.generate)(extracted.src, { ...extracted.operations, ...operations }, { baseURL: extracted.options.baseURL });
        }
    }
    return (0, exports.generate)(src, operations, { baseURL });
};
exports.transform = transform;
