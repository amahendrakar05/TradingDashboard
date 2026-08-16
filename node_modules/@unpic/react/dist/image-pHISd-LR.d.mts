import * as react from 'react';
import { UnpicImageProps } from '@unpic/core';

type ImageProps = UnpicImageProps<react.ImgHTMLAttributes<HTMLImageElement>>;
declare const Image: react.ForwardRefExoticComponent<ImageProps & react.RefAttributes<HTMLImageElement>>;

export { Image as I, type ImageProps as a };
