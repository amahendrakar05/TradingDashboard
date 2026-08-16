import { getProviderForUrlByPath } from "../detect.js";
import { createExtractAndGenerate, createOperationsHandlers, toCanonicalUrlString, toUrl, } from "../utils.js";
const VIEW_URL_SUFFIX = "/view?";
const PREVIEW_URL_SUFFIX = "/preview?";
const { operationsGenerator, operationsParser } = createOperationsHandlers({
    keyMap: {
        format: "output",
    },
    kvSeparator: "=",
    paramSeparator: "&",
});
export const generate = (src, modifiers) => {
    const url = toUrl(src.toString().replace(VIEW_URL_SUFFIX, PREVIEW_URL_SUFFIX));
    const projectParam = url.searchParams.get("project") ?? "";
    const operations = operationsGenerator(modifiers);
    url.search = operations;
    url.searchParams.append("project", projectParam);
    return toCanonicalUrlString(url);
};
export const extract = (url) => {
    if (getProviderForUrlByPath(url) !== "appwrite") {
        return null;
    }
    const parsedUrl = toUrl(url);
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
export const transform = createExtractAndGenerate(extract, generate);
