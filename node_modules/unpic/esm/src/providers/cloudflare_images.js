import { createOperationsHandlers, toCanonicalUrlString, toUrl, } from "../utils.js";
const cloudflareImagesRegex = /https?:\/\/(?<host>[^\/]+)\/cdn-cgi\/imagedelivery\/(?<accountHash>[^\/]+)\/(?<imageId>[^\/]+)\/*(?<transformations>[^\/]+)*$/g;
const imagedeliveryRegex = /https?:\/\/(?<host>imagedelivery.net)\/(?<accountHash>[^\/]+)\/(?<imageId>[^\/]+)\/*(?<transformations>[^\/]+)*$/g;
const { operationsGenerator, operationsParser } = createOperationsHandlers({
    keyMap: {
        width: "w",
        height: "h",
        format: "f",
    },
    defaults: {
        fit: "cover",
    },
    kvSeparator: "=",
    paramSeparator: ",",
});
function formatUrl(options, transformations) {
    const { host, accountHash, imageId } = options;
    if (!host || !accountHash || !imageId) {
        throw new Error("Missing required Cloudflare Images options");
    }
    const pathSegments = [
        "https:/",
        ...(host === "imagedelivery.net"
            ? [host]
            : [host, "cdn-cgi", "imagedelivery"]),
        accountHash,
        imageId,
        transformations,
    ].filter(Boolean);
    return pathSegments.join("/");
}
export const generate = (_src, operations, options = {}) => {
    const transformations = operationsGenerator(operations);
    const url = formatUrl(options, transformations);
    return toCanonicalUrlString(toUrl(url));
};
export const extract = (url) => {
    const parsedUrl = toUrl(url);
    const matches = [
        ...parsedUrl.toString().matchAll(cloudflareImagesRegex),
        ...parsedUrl.toString().matchAll(imagedeliveryRegex),
    ];
    if (!matches[0]?.groups) {
        return null;
    }
    const { host, accountHash, imageId, transformations } = matches[0].groups;
    const operations = operationsParser(transformations || "");
    const options = { host, accountHash, imageId };
    return {
        src: formatUrl(options),
        operations,
        options: options,
    };
};
export const transform = (src, operations, options = {}) => {
    const extracted = extract(src);
    if (!extracted) {
        throw new Error("Invalid Cloudflare Images URL");
    }
    const newOperations = { ...extracted.operations, ...operations };
    return generate(extracted.src, newOperations, {
        ...extracted.options,
        ...options,
    });
};
