"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.transform = exports.extract = exports.generate = void 0;
const detect_js_1 = require("../detect.js");
const utils_js_1 = require("../utils.js");
const VIEW_URL_SUFFIX = "/view?";
const PREVIEW_URL_SUFFIX = "/preview?";
const { operationsGenerator, operationsParser } = (0, utils_js_1.createOperationsHandlers)({
    keyMap: {
        format: "output",
    },
    kvSeparator: "=",
    paramSeparator: "&",
});
const generate = (src, modifiers) => {
    const url = (0, utils_js_1.toUrl)(src.toString().replace(VIEW_URL_SUFFIX, PREVIEW_URL_SUFFIX));
    const projectParam = url.searchParams.get("project") ?? "";
    const operations = operationsGenerator(modifiers);
    url.search = operations;
    url.searchParams.append("project", projectParam);
    return (0, utils_js_1.toCanonicalUrlString)(url);
};
exports.generate = generate;
const extract = (url) => {
    if ((0, detect_js_1.getProviderForUrlByPath)(url) !== "appwrite") {
        return null;
    }
    const parsedUrl = (0, utils_js_1.toUrl)(url);
    const operations = operationsParser(parsedUrl);
    // deno-lint-ignore no-explicit-any
    delete operations.project;
    const projectParam = parsedUrl.searchParams.get("project") ?? "";
    parsedUrl.search = "";
    parsedUrl.searchParams.append("project", projectParam);
    const sourceUrl = parsedUrl.href;
    return {
        src: sourceUrl,
        operations,
    };
};
exports.extract = extract;
exports.transform = (0, utils_js_1.createExtractAndGenerate)(exports.extract, exports.generate);
