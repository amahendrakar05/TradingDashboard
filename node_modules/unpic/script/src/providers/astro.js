"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.transform = exports.extract = exports.generate = void 0;
const utils_js_1 = require("../utils.js");
const DEFAULT_ENDPOINT = "/_image";
const { operationsParser, operationsGenerator } = (0, utils_js_1.createOperationsHandlers)({
    keyMap: {
        format: "f",
        width: "w",
        height: "h",
        quality: "q",
    },
    defaults: {
        fit: "cover",
    },
});
const generate = (src, modifiers, options) => {
    const url = (0, utils_js_1.toUrl)(`${(0, utils_js_1.stripTrailingSlash)(options?.baseUrl ?? "")}${options?.endpoint ?? DEFAULT_ENDPOINT}`);
    const operations = operationsGenerator(modifiers);
    url.search = operations;
    url.searchParams.set("href", src.toString());
    return (0, utils_js_1.toCanonicalUrlString)(url);
};
exports.generate = generate;
const extract = (url) => {
    const parsedUrl = (0, utils_js_1.toUrl)(url);
    const src = parsedUrl.searchParams.get("href");
    if (!src) {
        return null;
    }
    parsedUrl.searchParams.delete("href");
    const operations = operationsParser(parsedUrl);
    return {
        src,
        operations,
        options: { baseUrl: parsedUrl.origin },
    };
};
exports.extract = extract;
const transform = (src, operations, options = {}) => {
    const url = (0, utils_js_1.toUrl)(src);
    if (url.pathname !== (options?.endpoint ?? DEFAULT_ENDPOINT)) {
        return (0, exports.generate)(src, operations, options);
    }
    const base = (0, exports.extract)(src);
    if (!base) {
        return (0, exports.generate)(src, operations, options);
    }
    options.baseUrl ??= base.options.baseUrl;
    return (0, exports.generate)(base.src, {
        ...base.operations,
        ...operations,
    }, options);
};
exports.transform = transform;
