import { IncomingHttpHeaders, OutgoingHttpHeaders } from "node:http";

//#region src/server/csp.d.ts
type NodeHeaders = IncomingHttpHeaders | OutgoingHttpHeaders;
declare function getScriptNonceFromHeader(cspHeaderValue: string): string | undefined;
declare function getScriptNonceFromHeaders(headers: Headers | null | undefined): string | undefined;
declare function getScriptNonceFromNodeHeaderSources(...headersList: readonly (NodeHeaders | null | undefined)[]): string | undefined;
declare function getScriptNonceFromHeaderSources(...headersList: readonly (Headers | null | undefined)[]): string | undefined;
//#endregion
export { getScriptNonceFromHeader, getScriptNonceFromHeaderSources, getScriptNonceFromHeaders, getScriptNonceFromNodeHeaderSources };