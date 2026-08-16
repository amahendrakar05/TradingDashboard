import * as react from 'react';
import { ImageProps } from './next-legacy.js';
import './image-pHISd-LR.js';
import '@unpic/core';

/**
 * @deprecated Please use `@unpic/react/nextjs` or `"@unpic/react/next-legacy` instead
 */
declare const Image: react.ForwardRefExoticComponent<Omit<ImageProps, "ref"> & react.RefAttributes<HTMLImageElement>>;

export { Image };
