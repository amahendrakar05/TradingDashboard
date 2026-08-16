"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.transform = exports.extract = exports.generate = void 0;
const utils_js_1 = require("../utils.js");
const STORAGE_URL_PREFIX = "/storage/v1/object/public/";
const RENDER_URL_PREFIX = "/storage/v1/render/image/public/";
const isRenderUrl = (url) => url.pathname.startsWith(RENDER_URL_PREFIX);
const { operationsGenerator, operationsParser } = (0, utils_js_1.createOperationsHandlers)({});
const generate = (src, operations) => {
    const url = (0, utils_js_1.toUrl)(src);
    const basePath = url.pathname.replace(RENDER_URL_PREFIX, STORAGE_URL_PREFIX);
    // Update the pathname with the cleaned version
    url.pathname = basePath;
    // Supabase uses auto-format unless set to origin. Specific formats are not supported
    if (operations.format && operations.format !== "origin") {
        delete operations.format;
    }
    // Add query parameters for image transformation
    url.search = operationsGenerator(operations);
    // Replace with the render prefix for rendering
    return (0, utils_js_1.toCanonicalUrlString)(url).replace(STORAGE_URL_PREFIX, RENDER_URL_PREFIX);
};
exports.generate = generate;
const extract = (url) => {
    const parsedUrl = (0, utils_js_1.toUrl)(url);
    const operations = operationsParser(parsedUrl);
    const isRender = isRenderUrl(parsedUrl);
    const imagePath = parsedUrl.pathname.replace(RENDER_URL_PREFIX, "").replace(STORAGE_URL_PREFIX, "");
    if (!isRender) {
        return {
            src: (0, utils_js_1.toCanonicalUrlString)(parsedUrl),
            operations,
        };
    }
    return {
        src: `${parsedUrl.origin}${STORAGE_URL_PREFIX}${imagePath}`,
        operations,
    };
};
exports.extract = extract;
exports.transform = (0, utils_js_1.createExtractAndGenerate)(exports.extract, exports.generate);
