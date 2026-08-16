"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.transform = exports.generate = exports.extract = void 0;
const utils_js_1 = require("../utils.js");
const utils_js_2 = require("../utils.js");
const uploadcareRegex = /^https?:\/\/(?<host>[^\/]+)\/(?<uuid>[^\/]+)(?:\/(?<filename>[^\/]+)?)?/;
const { operationsGenerator, operationsParser } = (0, utils_js_2.createOperationsHandlers)({
    keyMap: {
        width: false,
        height: false,
    },
    defaults: {
        format: "auto",
    },
    kvSeparator: "/",
    paramSeparator: "/-/",
});
const extract = (url) => {
    const parsedUrl = (0, utils_js_2.toUrl)(url);
    const match = uploadcareRegex.exec(parsedUrl.toString());
    if (!match || !match.groups) {
        return null;
    }
    const { host, uuid } = match.groups;
    const [, ...operationsString] = parsedUrl.pathname.split("/-/");
    const operations = operationsParser(operationsString.join("/-/") || "");
    if (operations.resize) {
        const [width, height] = operations.resize.split("x");
        if (width)
            operations.width = parseInt(width);
        if (height)
            operations.height = parseInt(height);
        delete operations.resize;
    }
    return {
        src: `https://${host}/${uuid}/`,
        operations,
        options: { host },
    };
};
exports.extract = extract;
const generate = (src, operations, options = {}) => {
    const url = (0, utils_js_2.toUrl)(src);
    const host = options.host || url.hostname;
    // Strip filename from the URL
    const match = uploadcareRegex.exec(url.toString());
    if (match?.groups) {
        url.pathname = `/${match.groups.uuid}/`;
    }
    operations.resize = operations.resize ||
        `${operations.width ?? ""}x${operations.height ?? ""}`;
    delete operations.width;
    delete operations.height;
    const modifiers = (0, utils_js_2.addTrailingSlash)(operationsGenerator(operations));
    url.hostname = host;
    url.pathname = (0, utils_js_1.stripTrailingSlash)(url.pathname) +
        (modifiers ? `/-/${modifiers}` : "") + (match?.groups?.filename ?? "");
    return (0, utils_js_2.toCanonicalUrlString)(url);
};
exports.generate = generate;
exports.transform = (0, utils_js_2.createExtractAndGenerate)(exports.extract, exports.generate);
