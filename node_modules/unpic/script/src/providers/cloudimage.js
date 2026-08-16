"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.transform = exports.extract = exports.generate = void 0;
const detect_js_1 = require("../detect.js");
const utils_js_1 = require("../utils.js");
const { operationsGenerator, operationsParser } = (0, utils_js_1.createOperationsHandlers)({
    keyMap: {
        format: "force_format",
        width: "w",
        height: "h",
        quality: "q",
    },
    defaults: {
        org_if_sml: 1,
    },
});
const generate = (src, modifiers = {}, { token } = {}) => {
    if (!token) {
        throw new Error("Token is required for Cloudimage URLs" + src);
    }
    let srcString = src.toString();
    srcString = srcString.replace(/^https?:\/\//, "");
    if (srcString.includes("?")) {
        modifiers.ci_url_encoded = 1;
        srcString = encodeURIComponent(srcString);
    }
    const operations = operationsGenerator(modifiers);
    const url = new URL(`https://${token}.cloudimg.io/`);
    url.pathname = srcString;
    url.search = operations;
    return url.toString();
};
exports.generate = generate;
const extract = (src, options = {}) => {
    const url = (0, utils_js_1.toUrl)(src);
    if ((0, detect_js_1.getProviderForUrl)(url) !== "cloudimage") {
        return null;
    }
    const operations = operationsParser(url);
    let originalSrc = url.pathname;
    if (operations.ci_url_encoded) {
        originalSrc = decodeURIComponent(originalSrc);
        delete operations.ci_url_encoded;
    }
    options.token ??= url.hostname.replace(".cloudimg.io", "");
    return {
        src: `${url.protocol}/${originalSrc}`,
        operations,
        options,
    };
};
exports.extract = extract;
exports.transform = (0, utils_js_1.createExtractAndGenerate)(exports.extract, exports.generate);
