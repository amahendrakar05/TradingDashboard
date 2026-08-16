import { getProviderForUrlByPath } from "../detect.js";
import { createExtractAndGenerate, createOperationsHandlers, stripLeadingSlash, toCanonicalUrlString, toUrl, } from "../utils.js";
const { operationsGenerator, operationsParser } = createOperationsHandlers({
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
export const generate = (src, operations, options) => {
    const modifiers = operationsGenerator(operations);
    const url = toUrl(options?.domain ? `https://${options.domain}` : "/");
    url.pathname = `/cdn-cgi/image/${modifiers}/${stripLeadingSlash(src.toString())}`;
    return toCanonicalUrlString(url);
};
export const extract = (url, options) => {
    if (getProviderForUrlByPath(url) !== "cloudflare") {
        return null;
    }
    const parsedUrl = toUrl(url);
    const [, , , modifiers, ...src] = parsedUrl.pathname.split("/");
    const operations = operationsParser(modifiers);
    return {
        src: toCanonicalUrlString(toUrl(src.join("/"))),
        operations,
        options: {
            domain: options?.domain ??
                (parsedUrl.hostname === "n" ? undefined : parsedUrl.hostname),
        },
    };
};
export const transform = createExtractAndGenerate(extract, generate);
