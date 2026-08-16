"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.transform = exports.extract = exports.generate = void 0;
const detect_js_1 = require("../detect.js");
const utils_js_1 = require("../utils.js");
const { operationsGenerator, operationsParser } = (0, utils_js_1.createOperationsHandlers)({
    keyMap: {
        "format": "f",
    },
    defaults: {
        format: "auto",
        fit: "cover",
    },
    formatMap: {
        jpg: "jpeg",
    },
    kvSeparator: "=",
    paramSeparator: ",",
});
const generate = (src, operations, options) => {
    const modifiers = operationsGenerator(operations);
    const url = (0, utils_js_1.toUrl)(options?.domain ? `https://${options.domain}` : "/");
    url.pathname = `/cdn-cgi/image/${modifiers}/${(0, utils_js_1.stripLeadingSlash)(src.toString())}`;
    return (0, utils_js_1.toCanonicalUrlString)(url);
};
exports.generate = generate;
const extract = (url, options) => {
    if ((0, detect_js_1.getProviderForUrlByPath)(url) !== "cloudflare") {
        return null;
    }
    const parsedUrl = (0, utils_js_1.toUrl)(url);
    const [, , , modifiers, ...src] = parsedUrl.pathname.split("/");
    const operations = operationsParser(modifiers);
    return {
        src: (0, utils_js_1.toCanonicalUrlString)((0, utils_js_1.toUrl)(src.join("/"))),
        operations,
        options: {
            domain: options?.domain ??
                (parsedUrl.hostname === "n" ? undefined : parsedUrl.hostname),
        },
    };
};
exports.extract = extract;
exports.transform = (0, utils_js_1.createExtractAndGenerate)(exports.extract, exports.generate);
