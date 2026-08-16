import type { Plugin } from 'vite';
export declare const TAG = "[vite-plugin-commonjs]";
export type ImportInteropType = 'defaultFirst' | 'namedFirst' | 'merge';
export interface CommonjsOptions {
    filter?: (id: string) => boolean | undefined;
    dynamic?: {
        /**
         * 1. `true` - Match all possibilities as much as possible, more like `webpack`
         * 2. `false` - It behaves more like `@rollup/plugin-dynamic-import-vars`
         * @default true
         */
        loose?: boolean;
        /**
         * If you want to exclude some files
         * e.g.
         * ```js
         * commonjs({
         *   dynamic: {
         *     onFiles: files => files.filter(f => f !== 'types.d.ts')
         *   }
         * })
         * ```
        */
        onFiles?: (files: string[], id: string) => typeof files | undefined;
    };
    advanced?: {
        /**
         * Custom import module interop behavior.
         *
         * If you want to fully customize the interop behavior,
         * you can pass a function and return the interop code snippet.
         */
        importRules?: ImportInteropType | ((id: string) => ImportInteropType | string);
    };
}
export default function commonjs(options?: CommonjsOptions): Plugin;
