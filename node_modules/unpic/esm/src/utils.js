export function roundIfNumeric(value) {
    if (!value) {
        // deno-lint-ignore no-explicit-any
        return value;
    }
    const num = Number(value);
    if (isNaN(num)) {
        // deno-lint-ignore no-explicit-any
        return value;
    }
    // deno-lint-ignore no-explicit-any
    return Math.round(num);
}
/**
 * Given a URL object, returns path and query params
 */
export const toRelativeUrl = (url) => {
    const { pathname, search } = url;
    return `${pathname}${search}`;
};
/**
 * Returns a URL string that may be relative or absolute
 */
export const toCanonicalUrlString = (url) => {
    return url.hostname === "n" ? toRelativeUrl(url) : url.toString();
};
/**
 * Normalises a URL object or string URL to a URL object.
 */
export const toUrl = (url, base) => {
    return typeof url === "string" ? new URL(url, base ?? "http://n/") : url;
};
/**
 * Escapes a string, even if it's URL-safe
 */
export const escapeChar = (text) => text === " " ? "+" : ("%" +
    text.charCodeAt(0).toString(16).toUpperCase().padStart(2, "0"));
export const stripLeadingSlash = (str) => str?.startsWith("/") ? str.slice(1) : str;
export const stripTrailingSlash = (str) => str?.endsWith("/") ? str.slice(0, -1) : str;
export const addLeadingSlash = (str) => str?.startsWith("/") ? str : `/${str}`;
export const addTrailingSlash = (str) => str?.endsWith("/") ? str : `${str}/`;
/**
 * Creates a formatter given an operation joiner and key/value joiner
 */
export const createFormatter = (kvSeparator, paramSeparator) => {
    const encodedValueJoiner = escapeChar(kvSeparator);
    const encodedOperationJoiner = escapeChar(paramSeparator);
    function escape(value) {
        return encodeURIComponent(value).replaceAll(kvSeparator, encodedValueJoiner)
            .replaceAll(paramSeparator, encodedOperationJoiner);
    }
    function format(key, value) {
        return `${escape(key)}${kvSeparator}${escape(String(value))}`;
    }
    return (operations) => {
        const ops = Array.isArray(operations)
            ? operations
            : Object.entries(operations);
        return ops.flatMap(([key, value]) => {
            if (value === undefined || value === null) {
                return [];
            }
            if (Array.isArray(value)) {
                return value.map((v) => format(key, v));
            }
            return format(key, value);
        }).join(paramSeparator);
    };
};
/**
 * Creates a parser given an operation joiner and key/value joiner
 */
export const createParser = (kvSeparator, paramSeparator) => {
    if (kvSeparator === "=" && paramSeparator === "&") {
        return queryParser;
    }
    return (url) => {
        const urlString = url.toString();
        return Object.fromEntries(urlString.split(paramSeparator).map((pair) => {
            const [key, value] = pair.split(kvSeparator);
            return [decodeURI(key), decodeURI(value)];
        }));
    };
};
/**
 * Clamp width and height, maintaining aspect ratio
 */
export function clampDimensions(operations, maxWidth = 4000, maxHeight = 4000) {
    let { width, height } = operations;
    width = Number(width) || undefined;
    height = Number(height) || undefined;
    if (width && width > maxWidth) {
        if (height) {
            height = Math.round(height * maxWidth / width);
        }
        width = maxWidth;
    }
    if (height && height > maxHeight) {
        if (width) {
            width = Math.round(width * maxHeight / height);
        }
        height = maxHeight;
    }
    return { width, height };
}
export function extractFromURL(url) {
    const parsedUrl = toUrl(url);
    const operations = Object.fromEntries(parsedUrl.searchParams.entries());
    for (const key in ["width", "height", "quality"]) {
        const value = operations[key];
        if (value) {
            const newVal = Number(value);
            if (!isNaN(newVal)) {
                // deno-lint-ignore no-explicit-any
                operations[key] = newVal;
            }
        }
    }
    parsedUrl.search = "";
    return {
        operations: operations,
        src: toCanonicalUrlString(parsedUrl),
    };
}
export function normaliseOperations({ keyMap = {}, formatMap = {}, defaults = {} }, operations) {
    if (operations.format && operations.format in formatMap) {
        operations.format = formatMap[operations.format];
    }
    if (operations.width) {
        operations.width = roundIfNumeric(operations.width);
    }
    if (operations.height) {
        operations.height = roundIfNumeric(operations.height);
    }
    for (const k in keyMap) {
        if (!Object.prototype.hasOwnProperty.call(keyMap, k)) {
            continue;
        }
        const key = k;
        if (keyMap[key] === false) {
            delete operations[key];
            continue;
        }
        if (keyMap[key] && operations[key]) {
            operations[keyMap[key]] = operations[key];
            delete operations[key];
        }
    }
    for (const k in defaults) {
        if (!Object.prototype.hasOwnProperty.call(defaults, k)) {
            continue;
        }
        const key = k;
        const value = defaults[key];
        if (!operations[key] && value !== undefined) {
            if (keyMap[key] === false) {
                continue;
            }
            const resolvedKey = keyMap[key] ?? key;
            if (resolvedKey in operations) {
                continue;
            }
            // deno-lint-ignore no-explicit-any
            operations[resolvedKey] = value;
        }
    }
    return operations;
}
const invertMap = (
// deno-lint-ignore no-explicit-any
map) => Object.fromEntries(Object.entries(map).map(([k, v]) => [v, k]));
export function denormaliseOperations({ keyMap = {}, formatMap = {}, defaults = {} }, operations) {
    const invertedKeyMap = invertMap(keyMap);
    const invertedFormatMap = invertMap(formatMap);
    const ops = normaliseOperations({
        keyMap: invertedKeyMap,
        formatMap: invertedFormatMap,
        defaults,
    }, operations);
    if (ops.width) {
        ops.width = roundIfNumeric(ops.width);
    }
    if (ops.height) {
        ops.height = roundIfNumeric(ops.height);
    }
    const q = Number(ops.quality);
    if (!isNaN(q)) {
        ops.quality = q;
    }
    return ops;
}
// Parses a query string
const queryParser = (url) => {
    const parsedUrl = toUrl(url);
    return Object.fromEntries(parsedUrl.searchParams.entries());
};
export function createOperationsGenerator({ kvSeparator = "=", paramSeparator = "&", ...options } = {}) {
    const formatter = createFormatter(kvSeparator, paramSeparator);
    return (operations) => {
        const normalisedOperations = normaliseOperations(options, operations);
        return formatter(normalisedOperations);
    };
}
export function createOperationsParser({ kvSeparator = "=", paramSeparator = "&", defaults: _, ...options } = {}) {
    const parser = createParser(kvSeparator, paramSeparator);
    return (url) => {
        const operations = url ? parser(url) : {};
        return denormaliseOperations(options, operations);
    };
}
export function createOperationsHandlers(config) {
    const operationsGenerator = createOperationsGenerator(config);
    const operationsParser = createOperationsParser(config);
    return { operationsGenerator, operationsParser };
}
export function paramToBoolean(value) {
    if (value === undefined || value === null) {
        return undefined;
    }
    try {
        return Boolean(JSON.parse(value?.toString()));
    }
    catch {
        return Boolean(value);
    }
}
const removeUndefined = (obj) => Object.fromEntries(Object.entries(obj).filter(([, value]) => value !== undefined));
export function createExtractAndGenerate(extract, generate) {
    return ((src, operations, options) => {
        const base = extract(src, options);
        if (!base) {
            return generate(src, operations, options);
        }
        return generate(base.src, {
            ...base.operations,
            ...removeUndefined(operations),
        }, {
            // deno-lint-ignore no-explicit-any
            ...base.options,
            ...options,
        });
    });
}
