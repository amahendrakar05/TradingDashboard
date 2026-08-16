import { stripTrailingSlash } from "../utils.js";
import { addTrailingSlash, createExtractAndGenerate, createOperationsHandlers, toCanonicalUrlString, toUrl, } from "../utils.js";
const uploadcareRegex = /^https?:\/\/(?<host>[^\/]+)\/(?<uuid>[^\/]+)(?:\/(?<filename>[^\/]+)?)?/;
const { operationsGenerator, operationsParser } = createOperationsHandlers({
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
export const extract = (url) => {
    const parsedUrl = toUrl(url);
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
export const generate = (src, operations, options = {}) => {
    const url = toUrl(src);
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
    const modifiers = addTrailingSlash(operationsGenerator(operations));
    url.hostname = host;
    url.pathname = stripTrailingSlash(url.pathname) +
        (modifiers ? `/-/${modifiers}` : "") + (match?.groups?.filename ?? "");
    return toCanonicalUrlString(url);
};
export const transform = createExtractAndGenerate(extract, generate);
