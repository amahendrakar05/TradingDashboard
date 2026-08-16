import { createOperationsHandlers } from "../utils.js";
const publicRegex = /https?:\/\/(?<host>res\.cloudinary\.com)\/(?<cloudName>[a-zA-Z0-9-]+)\/(?<assetType>image|video|raw)\/(?<deliveryType>upload|fetch|private|authenticated|sprite|facebook|twitter|youtube|vimeo)\/?(?<signature>s\-\-[a-zA-Z0-9]+\-\-)?\/?(?<transformations>(?:[^_\/]+_[^,\/]+,?)*)?\/(?:(?<version>v\d+)\/)?(?<id>(?:[^\s\/]+\/)*[^\s\/]+(?:\.[a-zA-Z0-9]+)?)$/;
const privateRegex = /https?:\/\/(?<host>(?<cloudName>[a-zA-Z0-9-]+)-res\.cloudinary\.com|[a-zA-Z0-9.-]+)\/(?<assetType>image|video|raw)\/(?<deliveryType>upload|fetch|private|authenticated|sprite|facebook|twitter|youtube|vimeo)\/?(?<signature>s\-\-[a-zA-Z0-9]+\-\-)?\/?(?<transformations>(?:[^_\/]+_[^,\/]+,?)*)?\/(?:(?<version>v\d+)\/)?(?<id>(?:[^\s\/]+\/)*[^\s\/]+(?:\.[a-zA-Z0-9]+)?)$/;
const { operationsGenerator, operationsParser } = createOperationsHandlers({
    keyMap: {
        width: "w",
        height: "h",
        format: "f",
        quality: "q",
    },
    defaults: {
        format: "auto",
        c: "lfill",
    },
    kvSeparator: "_",
    paramSeparator: ",",
});
export const generate = (src, operations) => {
    const group = parseCloudinaryUrl(src.toString());
    if (!group) {
        return src.toString();
    }
    group.transformations = operationsGenerator(operations);
    return formatCloudinaryUrl(group);
};
function formatCloudinaryUrl({ host, cloudName, assetType, deliveryType, signature, transformations, version, id, }) {
    const isPublic = host === "res.cloudinary.com";
    return [
        "https:/",
        host,
        isPublic ? cloudName : undefined,
        assetType,
        deliveryType,
        signature,
        transformations,
        version,
        id,
    ].filter(Boolean).join("/");
}
function parseCloudinaryUrl(url) {
    let matches = url.toString().match(publicRegex);
    if (!matches?.length) {
        matches = url.toString().match(privateRegex);
    }
    if (!matches?.length) {
        return null;
    }
    return matches.groups || {};
}
export const extract = (url) => {
    const group = parseCloudinaryUrl(url.toString());
    if (!group) {
        return null;
    }
    const { transformations: transformString = "", ...params } = group;
    const src = formatCloudinaryUrl(params);
    const operations = operationsParser(transformString) || {};
    return {
        src,
        operations,
        options: {
            cloudName: params.cloudName,
            domain: params.host,
            privateCdn: params.host !== "res.cloudinary.com",
        },
    };
};
export const transform = (src, operations) => {
    const group = parseCloudinaryUrl(src.toString());
    if (!group) {
        return src.toString();
    }
    const existing = operationsParser(group.transformations || "");
    group.transformations = operationsGenerator({
        ...existing,
        ...operations,
    });
    return formatCloudinaryUrl(group);
};
