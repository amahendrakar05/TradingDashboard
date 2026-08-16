import type { Analyzed } from './analyze';
export interface ExportsRuntime {
    polyfill: string;
    exportDeclaration: string;
}
export declare function generateExport(analyzed: Analyzed): ExportsRuntime | null;
