import * as react_jsx_runtime from 'react/jsx-runtime';
import * as react from 'react';
import { Operations, UnpicBaseImageProps, UnpicBaseSourceProps } from '@unpic/core/base';
export { UnpicBaseSourceProps as SourceProps } from '@unpic/core/base';

type ImageProps<TOperations extends Operations, TOptions> = UnpicBaseImageProps<TOperations, TOptions, react.ImgHTMLAttributes<HTMLImageElement>>;
declare function Image<TOperations extends Operations, O>({ transformer, ...props }: ImageProps<TOperations, O>): react_jsx_runtime.JSX.Element;

declare function Source<TOperations extends Operations, TOptions>(props: UnpicBaseSourceProps<TOperations, TOptions>): react_jsx_runtime.JSX.Element;

export { Image, type ImageProps, Source };
