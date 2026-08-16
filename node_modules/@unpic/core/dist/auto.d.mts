import { CoreImageAttributes, UnpicImageProps, CoreSourceAttributes, UnpicSourceProps } from './base.mjs';
export { BaseImageSourceOptions, DEFAULT_RESOLUTIONS, ImageSourceOptions, Layout, ObjectFit, UnpicBaseImageProps, UnpicBaseSourceProps, getBreakpoints, getSizes, getSrcSet, getSrcSetEntries, getStyle, inferImageDimensions, normalizeImageType } from './base.mjs';
export { Operations } from 'unpic';

/**
 * Generates the props for an img element
 */
declare function transformProps<TImageAttributes extends CoreImageAttributes<TStyle>, TStyle = TImageAttributes["style"]>({ cdn, fallback, operations, options, ...props }: UnpicImageProps<TImageAttributes, TStyle>): TImageAttributes;
/**
 * Generates the props for a `<source>` element
 */
declare function transformSourceProps<TSourceAttributes extends CoreSourceAttributes>({ cdn, fallback, operations, options, ...props }: UnpicSourceProps): TSourceAttributes;

export { CoreImageAttributes, CoreSourceAttributes, UnpicImageProps, UnpicSourceProps, transformProps, transformSourceProps };
