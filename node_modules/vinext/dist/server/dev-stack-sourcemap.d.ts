import { VINEXT_ORIGINAL_STACK_TRACE_ENDPOINT } from "../utils/dev-stack-sourcemap-endpoint.js";
import { ViteDevServer } from "vite";

//#region src/server/dev-stack-sourcemap.d.ts
type SourceMapPayload = {
  version?: number;
  sources: string[];
  sourcesContent?: (string | null)[];
  sourceRoot?: string;
  mappings: string;
  ignoreList?: number[];
};
type SourceMapPosition = {
  source: string;
  line: number;
  column: number;
};
type StackCodeFramePayload = {
  file: string;
  line: number;
  column: number;
  methodName?: string;
  lines: StackCodeFrameLine[];
};
type StackCodeFrameLine = {
  line: number;
  text: string;
  isErrorLine: boolean;
};
type MappedStackLine = {
  line: string;
  isFrame: boolean;
  ignored: boolean;
  codeFrame?: StackCodeFramePayload;
};
declare function installDevStackSourcemapMiddleware(server: ViteDevServer): void;
declare function mapStackLine(server: ViteDevServer, line: string, requestHost: string | undefined, sourceMapCache: Map<string, Promise<SourceMapPayload | null>>): Promise<string>;
declare function mapStackLineWithMetadata(server: ViteDevServer, line: string, requestHost: string | undefined, sourceMapCache: Map<string, Promise<SourceMapPayload | null>>): Promise<MappedStackLine>;
declare function originalPositionFor(sourceMap: SourceMapPayload, generatedLine: number, generatedColumn: number): SourceMapPosition | null;
declare function decodeVlqSegment(segment: string): number[];
declare function resolveSourceFile(source: string, sourceMap: SourceMapPayload, generatedUrl: URL): string;
//#endregion
export { SourceMapPayload, VINEXT_ORIGINAL_STACK_TRACE_ENDPOINT, decodeVlqSegment, installDevStackSourcemapMiddleware, mapStackLine, mapStackLineWithMetadata, originalPositionFor, resolveSourceFile };