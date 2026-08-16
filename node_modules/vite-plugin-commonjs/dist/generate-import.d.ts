import type { CommonjsOptions } from 'src';
import type { Analyzed } from './analyze';
export interface ImportRecord {
    node: AcornNode;
    importExpression?: string;
    importInterop?: string;
}
export declare function generateImport(analyzed: Analyzed, id: string, options: CommonjsOptions): ImportRecord[];
