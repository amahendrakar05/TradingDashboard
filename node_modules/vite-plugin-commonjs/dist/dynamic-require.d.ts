import type { ResolvedConfig } from 'vite';
import { Resolve } from 'vite-plugin-dynamic-import';
import { type CommonjsOptions } from '.';
import type { Analyzed } from './analyze';
export interface DynamicRequireRecord {
    node: AcornNode;
    /** normally path */
    normally?: string;
    dynaimc?: {
        importee: string[];
        runtimeName: string;
        runtimeFn: string;
    };
}
export declare class DynaimcRequire {
    private config;
    private options;
    private resolve;
    constructor(config: ResolvedConfig, options: CommonjsOptions & {
        extensions: string[];
    }, resolve?: Resolve);
    generateRuntime(analyzed: Analyzed): Promise<DynamicRequireRecord[] | null>;
}
