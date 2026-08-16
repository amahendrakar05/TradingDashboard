import { createOperationsHandlers, stripTrailingSlash, toCanonicalUrlString, toUrl, } from "../utils.js";
const DEFAULT_ENDPOINT = "/_image";
const { operationsParser, operationsGenerator } = createOperationsHandlers({
    keyMap: {
        format: "f",
        width: "w",
        height: "h",
        quality: "q",
    },
    defaults: {
        fit: "cover",
    },
});
export const generate = (src, modifiers, options) => {
    const url = toUrl(`${stripTrailingSlash(options?.baseUrl ?? "")}${options?.endpoint ?? DEFAULT_ENDPOINT}`);
    const operations = operationsGenerator(modifiers);
    url.search = operations;
    url.searchParams.set("href", src.toString());
    return toCanonicalUrlString(url);
};
export const extract = (url) => {
    const parsedUrl = toUrl(url);
    const src = parsedUrl.searchParams.get("href");
    if (!src) {
        return null;
    }
    parsedUrl.searchParams.delete("href");
    const operations = operationsParser(parsedUrl);
    return {
        src,
        operations,
        options: { baseUrl: parsedUrl.origin },
    };
};
export const transform = (src, operations, options = {}) => {
    const url = toUrl(src);
    if (url.pathname !== (options?.endpoint ?? DEFAULT_ENDPOINT)) {
        return generate(src, operations, options);
    }
    const base = extract(src);
    if (!base) {
        return generate(src, operations, options);
    }
    options.baseUrl ??= base.options.baseUrl;
    return generate(base.src, {
        ...base.operations,
        ...operations,
    }, options);
};
