import * as react from 'react';
import { a as ImageProps$1 } from './image-pHISd-LR.js';
import '@unpic/core';

interface StaticImageData {
    src: string;
    height: number;
    width: number;
    blurDataURL?: string;
    blurWidth?: number;
    blurHeight?: number;
}
interface StaticRequire {
    default: StaticImageData;
}
type StaticImport = StaticRequire | StaticImageData;
type ImageProps = Omit<ImageProps$1, "src"> & {
    src: string | StaticImport;
};
declare const Image: react.ForwardRefExoticComponent<Omit<ImageProps, "ref"> & react.RefAttributes<HTMLImageElement>>;

export { Image, type ImageProps };
