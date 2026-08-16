import { getProviderForUrl } from "../detect.js";
import { createExtractAndGenerate, createOperationsHandlers, toUrl, } from "../utils.js";
const { operationsGenerator, operationsParser } = createOperationsHandlers({
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
export const generate = (src, modifiers = {}, { token } = {}) => {
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
export const extract = (src, options = {}) => {
    const url = toUrl(src);
    if (getProviderForUrl(url) !== "cloudimage") {
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
export const transform = createExtractAndGenerate(extract, generate);
