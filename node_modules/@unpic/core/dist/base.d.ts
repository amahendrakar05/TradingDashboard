import { ImageCdn, ProviderOperations, ProviderOptions, Operations, TransformerFunction } from 'unpic';
export { Operations } from 'unpic';

/**
 * Core HTML image attributes common across frameworks.
 * For React and similar frameworks, attribute names are converted to camelCase.
 */
interface CoreImageAttributes<TStyle = Record<string, string>> {
    src?: string | number | null;
    width?: string | number | null;
    height?: string | number | null;
    alt?: string | number | null;
    loading?: "eager" | "lazy" | null;
    decoding?: "sync" | "async" | "auto" | null;
    style?: TStyle;
    srcset?: string | number | null;
    role?: "presentation" | "img" | "none" | "figure" | (string & {}) | null;
    sizes?: string | number | null;
    fetchpriority?: "high" | "low" | "auto" | null;
}
/**
 * Common options for CDN-based image components including layout preferences,
 * CDN configuration, and styling options.
 */
interface BaseOptions {
    src: string;
    cdn?: ImageCdn;
    fallback?: ImageCdn;
    operations?: Partial<ProviderOperations>;
    options?: Partial<ProviderOptions>;
    breakpoints?: number[];
    priority?: boolean;
    fetchpriority?: "high" | "low";
    background?: string;
    objectFit?: ObjectFit;
    unstyled?: boolean;
}
/**
 * Common options for transformer-based image components that use direct URL transformations
 * instead of a CDN configuration.
 */
interface BaseTransformerOptions<TOperations extends Operations, TOptions> {
    src: string;
    transformer: TransformerFunction<TOperations, TOptions>;
    operations?: TOperations & {
        width?: never;
        height?: never;
    };
    options?: TOptions;
    breakpoints?: number[];
    priority?: boolean;
    fetchpriority?: "high" | "low";
    background?: string;
    objectFit?: ObjectFit;
    unstyled?: boolean;
}
/**
 * Configuration options for image sources using CDN-based transformations.
 * Provides basic image parameters and CDN configuration without layout constraints.
 */
interface ImageSourceOptions {
    src: string;
    width?: number;
    height?: number;
    aspectRatio?: number;
    layout?: Layout;
    breakpoints?: number[];
    cdn?: ImageCdn;
    fallback?: ImageCdn;
    operations?: Partial<ProviderOperations>;
    options?: Partial<ProviderOptions>;
}
/**
 * Configuration options for image sources using URL transformer-based transformations.
 * Provides basic image parameters and transformer configuration without layout constraints.
 */
interface BaseImageSourceOptions<TOperations extends Operations, TOptions> {
    src: string;
    width?: number;
    height?: number;
    aspectRatio?: number;
    layout?: Layout;
    breakpoints?: number[];
    transformer?: TransformerFunction<TOperations, TOptions>;
    operations?: TOperations & {
        width?: never;
        height?: never;
    };
    options?: TOptions;
}
type WithWidthHeight = {
    width: number;
    height: number;
    aspectRatio?: never;
};
type WithAspectRatioAndWidth = {
    width: number;
    aspectRatio: number;
    height?: never;
};
type WithAspectRatioAndHeight = {
    height: number;
    aspectRatio: number;
    width?: never;
};
type DimensionRequirements = WithWidthHeight | WithAspectRatioAndWidth | WithAspectRatioAndHeight;
type FixedLayout = {
    layout: "fixed";
} & DimensionRequirements;
type ConstrainedLayout = {
    layout?: "constrained";
} & DimensionRequirements;
type FullWidthLayout = {
    layout: "fullWidth";
    width?: never;
    height?: number;
    aspectRatio?: number;
};
/**
 * Props for CDN-based image components with layout-specific dimension requirements.
 * Supports fixed, constrained, and full-width layouts with appropriate dimension constraints.
 */
type UnpicImageProps<TImageAttributes extends CoreImageAttributes<TStyle>, TStyle = TImageAttributes["style"]> = Omit<TImageAttributes, "srcset" | "style"> & BaseOptions & (FixedLayout | ConstrainedLayout | FullWidthLayout);
/**
 * Props for transformer-based image components with layout-specific dimension requirements.
 * Uses direct URL transformations instead of CDN configurations.
 */
type UnpicBaseImageProps<TOperations extends Operations, TOptions, TImageAttributes extends CoreImageAttributes<TStyle>, TStyle = TImageAttributes["style"]> = Omit<TImageAttributes, "srcset" | "style"> & BaseTransformerOptions<TOperations, TOptions> & (FixedLayout | ConstrainedLayout | FullWidthLayout);
/**
 * Core attributes for HTML source elements used in picture elements.
 */
interface CoreSourceAttributes {
    srcset?: string | null;
    type?: string | null;
    sizes?: string | null;
    media?: string | null;
}
/**
 * Props for CDN-based source elements with layout-specific dimension requirements.
 */
type UnpicSourceProps = Omit<CoreSourceAttributes, "srcset"> & BaseOptions & (FixedLayout | ConstrainedLayout | FullWidthLayout);
/**
 * Props for transformer-based source elements with layout-specific dimension requirements.
 * Uses direct URL transformations instead of CDN configurations.
 */
type UnpicBaseSourceProps<TOperations extends Operations, TOptions> = Omit<CoreSourceAttributes, "srcset"> & BaseTransformerOptions<TOperations, TOptions> & (FixedLayout | ConstrainedLayout | FullWidthLayout);
/**
 * Available layout modes for image components.
 * - fixed: Image maintains exact dimensions
 * - constrained: Image maintains aspect ratio and fits within given dimensions
 * - fullWidth: Image spans full width of container with optional height constraint
 */
type Layout = "fixed" | "constrained" | "fullWidth";
/**
 * Object-fit options for controlling how the image fills its container.
 */
type ObjectFit = "contain" | "cover" | "fill" | "none" | "scale-down" | "inherit" | "initial";

/**
 * Gets the `sizes` attribute for an image, based on the layout and width
 */
declare const getSizes: (width?: number, layout?: Layout) => string | undefined;
/**
 * Gets the styles for an image
 */
declare const getStyle: <TOperations extends Operations, TOptions, TImageAttributes extends CoreImageAttributes<TStyle>, TStyle = Record<string, string>>({ width, height, aspectRatio, layout, objectFit, background, }: Pick<UnpicBaseImageProps<TOperations, TOptions, TImageAttributes, TStyle>, "width" | "height" | "aspectRatio" | "layout" | "objectFit" | "background">) => TImageAttributes["style"];
declare const DEFAULT_RESOLUTIONS: number[];
/**
 * Gets the breakpoints for an image, based on the layout and width
 */
declare const getBreakpoints: ({ width, layout, resolutions, }: {
    width?: number;
    layout: Layout;
    resolutions?: Array<number>;
}) => number[];
type SrcSetOptions<TOperations extends Operations, TOptions> = Omit<BaseImageSourceOptions<TOperations, TOptions>, "src"> & {
    src: URL | string;
    format?: string;
};
interface UrlTransformerOptions extends Pick<Operations, "width" | "height" | "format" | "quality"> {
    /** The image URL to transform */
    url: string | URL;
}
declare const getSrcSetEntries: <TOperations extends Operations, TOptions>({ src, width, layout, height, aspectRatio, breakpoints, format, }: SrcSetOptions<TOperations, TOptions>) => Array<UrlTransformerOptions>;
/**
 * Generate an image srcset
 */
declare const getSrcSet: <TOperations extends Operations, TOptions>(options: SrcSetOptions<TOperations, TOptions>) => string;
declare function transformSharedProps<TOperations extends Operations, TOptions, TImageAttributes extends CoreImageAttributes<TStyle>, TStyle = Record<string, string>>({ width, height, priority, layout, aspectRatio, ...props }: UnpicBaseImageProps<TOperations, TOptions, TImageAttributes, TStyle>): UnpicBaseImageProps<TOperations, TOptions, TImageAttributes, TStyle> & Pick<TImageAttributes, "srcset" | "style">;
/**
 * Generates the props for an img element
 */
declare function transformBaseImageProps<TOperations extends Operations, TOptions, TImageAttributes extends CoreImageAttributes<TStyle>, TStyle = TImageAttributes["style"]>(props: UnpicBaseImageProps<TOperations, TOptions, TImageAttributes, TStyle>): TImageAttributes;
declare function normalizeImageType(type?: string | null): {
    format?: string;
    mimeType?: string;
};
/**
 * Generates the props for a `<source>` element
 */
declare function transformBaseSourceProps<TSourceAttributes extends CoreSourceAttributes, TOperations extends Operations, TOptions>({ media, type, ...props }: UnpicBaseSourceProps<TOperations, TOptions>): TSourceAttributes;
interface ImageSizeMetadata {
    width: number;
    height: number;
}
declare function inferImageDimensions(props: {
    width?: number;
    height?: number;
    aspectRatio?: number;
}, imageData: ImageSizeMetadata): {
    width: number;
    height: number;
};

export { type BaseImageSourceOptions, type CoreImageAttributes, type CoreSourceAttributes, DEFAULT_RESOLUTIONS, type ImageSizeMetadata, type ImageSourceOptions, type Layout, type ObjectFit, type SrcSetOptions, type UnpicBaseImageProps, type UnpicBaseSourceProps, type UnpicImageProps, type UnpicSourceProps, getBreakpoints, getSizes, getSrcSet, getSrcSetEntries, getStyle, inferImageDimensions, normalizeImageType, transformBaseImageProps, transformBaseSourceProps, transformSharedProps };
