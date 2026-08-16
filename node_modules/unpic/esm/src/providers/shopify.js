import { createExtractAndGenerate, createOperationsHandlers, toCanonicalUrlString, toUrl, } from "../utils.js";
const shopifyRegex = /(.+?)(?:_(?:(pico|icon|thumb|small|compact|medium|large|grande|original|master)|(\d*)x(\d*)))?(?:_crop_([a-z]+))?(\.[a-zA-Z]+)(\.png|\.jpg|\.webp|\.avif)?$/;
const { operationsGenerator, operationsParser } = createOperationsHandlers({
    keyMap: {
        format: false,
    },
});
export const generate = (src, operations) => {
    const url = toUrl(src);
    const basePath = url.pathname.replace(shopifyRegex, "$1$6");
    // Update pathname with the clean version (remove size details)
    url.pathname = basePath;
    // Add query parameters for size, format, etc.
    url.search = operationsGenerator(operations);
    return toCanonicalUrlString(url);
};
export const extract = (url) => {
    const parsedUrl = toUrl(url);
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
export const transform = createExtractAndGenerate(extract, generate);
