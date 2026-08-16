import type { ImageCdn, OperationFormatter, OperationParser, Operations, ProviderConfig, URLExtractor, URLGenerator, URLTransformer } from "./types.js";
export declare function roundIfNumeric<T extends string | number | undefined>(value: T): T extends undefined ? undefined : T extends number ? number : T extends string ? string | number : never;
/**
 * Given a URL object, returns path and query params
 */
export declare const toRelativeUrl: (url: URL) => string;
/**
 * Returns a URL string that may be relative or absolute
 */
export declare const toCanonicalUrlString: (url: URL) => string;
/**
 * Normalises a URL object or string URL to a URL object.
 */
export declare const toUrl: (url: string | URL, base?: string | URL | undefined) => URL;
/**
 * Escapes a string, even if it's URL-safe
 */
export declare const escapeChar: (text: string) => string;
export declare const stripLeadingSlash: (str?: string) => string | undefined;
export declare const stripTrailingSlash: (str?: string) => string | undefined;
export declare const addLeadingSlash: (str?: string) => string;
export declare const addTrailingSlash: (str?: string) => string;
/**
 * Creates a formatter given an operation joiner and key/value joiner
 */
export declare const createFormatter: (kvSeparator: string, paramSeparator: string) => OperationFormatter;
/**
 * Creates a parser given an operation joiner and key/value joiner
 */
export declare const createParser: <T extends Operations = Operations>(kvSeparator: string, paramSeparator: string) => OperationParser<T>;
/**
 * Clamp width and height, maintaining aspect ratio
 */
export declare function clampDimensions(operations: Operations, maxWidth?: number, maxHeight?: number): {
    width: number | undefined;
    height: number | undefined;
};
export declare function extractFromURL<T extends Operations = Operations>(url: string | URL): {
    operations: T;
    src: string;
};
export declare function normaliseOperations<T extends Operations = Operations>({ keyMap, formatMap, defaults }: Omit<ProviderConfig<T>, "formatter">, operations: T): T;
export declare function denormaliseOperations<T extends Operations = Operations>({ keyMap, formatMap, defaults }: Omit<ProviderConfig<T>, "formatter">, operations: T): T;
export declare function createOperationsGenerator<T extends Operations = Operations>({ kvSeparator, paramSeparator, ...options }?: ProviderConfig<T>): OperationFormatter<T>;
export declare function createOperationsParser<T extends Operations = Operations>({ kvSeparator, paramSeparator, defaults: _, ...options }?: ProviderConfig<T>): OperationParser<T>;
export declare function createOperationsHandlers<T extends Operations = Operations>(config: ProviderConfig<T>): {
    operationsGenerator: OperationFormatter<T>;
    operationsParser: OperationParser<T>;
};
export declare function paramToBoolean(value: boolean | string | number): boolean | undefined;
export declare function createExtractAndGenerate<TCDN extends ImageCdn>(extract: URLExtractor<TCDN>, generate: URLGenerator<TCDN>): URLTransformer<TCDN>;
//# sourceMappingURL=utils.d.ts.map