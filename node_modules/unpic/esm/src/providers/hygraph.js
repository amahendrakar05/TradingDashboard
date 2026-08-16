import { createExtractAndGenerate, createOperationsHandlers, toCanonicalUrlString, toUrl, } from "../utils.js";
const hygraphRegex = /https:\/\/(?<region>[a-z0-9-]+)\.graphassets\.com\/(?<envId>[a-zA-Z0-9]+)(?:\/(?<transformations>.*?))?\/(?<handle>[a-zA-Z0-9]+)$/;
const { operationsGenerator, operationsParser } = createOperationsHandlers({
    keyMap: {
        width: "width",
        height: "height",
        format: "format",
    },
    defaults: {
        format: "auto",
        fit: "crop",
    },
});
export const extract = (url) => {
    const parsedUrl = toUrl(url);
    const matches = parsedUrl.toString().match(hygraphRegex);
    if (!matches?.groups) {
        return null;
    }
    const { region, envId, handle, transformations } = matches.groups;
    // Parse any existing transformations from the URL
    const operations = {};
    if (transformations) {
        const parts = transformations.split("/");
        parts.forEach((part) => {
            const [operation, params] = part.split("=");
            if (operation === "resize" && params) {
                params.split(",").forEach((param) => {
                    const [key, value] = param.split(":");
                    if (key === "width" || key === "height") {
                        operations[key] = Number(value);
                    }
                    else if (key === "fit") {
                        operations.fit = value;
                    }
                });
            }
            else if (operation === "output" && params) {
                params.split(",").forEach((param) => {
                    const [key, value] = param.split(":");
                    if (key === "format") {
                        operations.format = value;
                    }
                });
            }
            else if (operation === "auto_image") {
                operations.format = "auto";
            }
        });
    }
    return {
        src: `https://${region}.graphassets.com/${envId}/${handle}`,
        operations,
        options: {
            region,
            envId,
            handle,
        },
    };
};
export const generate = (src, operations, options = {}) => {
    // First extract the components from the source URL
    const extracted = extract(src);
    if (!extracted) {
        throw new Error("Invalid Hygraph URL");
    }
    // Merge options
    const { region, envId, handle } = {
        ...extracted.options,
        ...options,
    };
    const transforms = [];
    // Add resize transformation if width or height is specified
    if (operations.width || operations.height) {
        const resize = [];
        // Always include fit:crop when both dimensions are specified to maintain aspect ratio
        if (operations.width && operations.height) {
            resize.push("fit:crop");
        }
        else if (operations.fit) {
            resize.push(`fit:${operations.fit}`);
        }
        if (operations.width)
            resize.push(`width:${operations.width}`);
        if (operations.height)
            resize.push(`height:${operations.height}`);
        if (resize.length)
            transforms.push(`resize=${resize.join(",")}`);
    }
    // Add format transformation
    if (operations.format === "auto" ||
        (!operations.format && !extracted.operations.format)) {
        transforms.push("auto_image");
    }
    else if (operations.format) {
        transforms.push(`output=format:${operations.format}`);
    }
    // Construct the URL in parts
    const baseUrl = `https://${region}.graphassets.com/${envId}`;
    const transformPart = transforms.length > 0 ? "/" + transforms.join("/") : "";
    const finalUrl = toUrl(`${baseUrl}${transformPart}/${handle}`);
    return toCanonicalUrlString(finalUrl);
};
export const transform = createExtractAndGenerate(extract, generate);
