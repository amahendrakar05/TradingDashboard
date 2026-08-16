"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.transform = exports.extract = exports.generate = void 0;
const utils_js_1 = require("../utils.js");
const shopifyRegex = /(.+?)(?:_(?:(pico|icon|thumb|small|compact|medium|large|grande|original|master)|(\d*)x(\d*)))?(?:_crop_([a-z]+))?(\.[a-zA-Z]+)(\.png|\.jpg|\.webp|\.avif)?$/;
const { operationsGenerator, operationsParser } = (0, utils_js_1.createOperationsHandlers)({
    keyMap: {
        format: false,
    },
});
const generate = (src, operations) => {
    const url = (0, utils_js_1.toUrl)(src);
    const basePath = url.pathname.replace(shopifyRegex, "$1$6");
    // Update pathname with the clean version (remove size details)
    url.pathname = basePath;
    // Add query parameters for size, format, etc.
    url.search = operationsGenerator(operations);
    return (0, utils_js_1.toCanonicalUrlString)(url);
};
exports.generate = generate;
const extract = (url) => {
    const parsedUrl = (0, utils_js_1.toUrl)(url);
    const match = shopifyRegex.exec(parsedUrl.pathname);
    const operations = operationsParser(parsedUrl);
    if (match) {
        const [, , , width, height, crop] = match;
        if (width && height && !operations.width && !operations.height) {
            operations.width = parseInt(width, 10);
            operations.height = parseInt(height, 10);
        }
        if (crop) {
            operations.crop ??= crop;
        }
    }
    const basePath = parsedUrl.pathname.replace(shopifyRegex, "$1$6");
    parsedUrl.pathname = basePath;
    for (const key of ["width", "height", "crop", "pad_color", "format"]) {
        parsedUrl.searchParams.delete(key);
    }
    return {
        src: parsedUrl.toString(),
        operations,
    };
};
exports.extract = extract;
exports.transform = (0, utils_js_1.createExtractAndGenerate)(exports.extract, exports.generate);
