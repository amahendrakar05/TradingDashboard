import { PagesBodyParseError } from "./pages-media-type.js";
import { RevalidateOptions } from "./pages-revalidate.js";
import { PagesPreviewData } from "./pages-preview.js";
import { Readable, Writable } from "node:stream";

//#region src/server/pages-node-compat.d.ts
type PagesRequestQuery = Record<string, string | string[]>;
type PagesReqResRequest = Readable & {
  method: string;
  url: string;
  headers: Record<string, string>;
  query: PagesRequestQuery;
  body: unknown;
  cookies: Record<string, string>;
  preview?: true;
  draftMode?: true;
  previewData: PagesPreviewData | false;
};
type PagesReqResHeaders = {
  [key: string]: string | number | boolean | string[];
};
type PagesReqResResponse = Writable & {
  statusCode: number;
  readonly headersSent: boolean;
  writeHead: (code: number, headers?: PagesReqResHeaders) => PagesReqResResponse;
  setHeader: (name: string, value: string | number | boolean | string[]) => PagesReqResResponse;
  getHeader: (name: string) => string | number | boolean | string[] | undefined;
  status: (code: number) => PagesReqResResponse;
  json: (data: unknown) => void;
  send: (data: unknown) => void;
  redirect: (statusOrUrl: number | string, url?: string) => PagesReqResResponse;
  getHeaders: () => PagesReqResHeaders;
  revalidate: (urlPath: string, opts?: RevalidateOptions) => Promise<void>;
  setPreviewData: (data: object | string, options?: {
    maxAge?: number;
    path?: string;
  }) => PagesReqResResponse;
  clearPreviewData: (options?: {
    path?: string;
  }) => PagesReqResResponse;
  setDraftMode: (options?: {
    enable?: boolean;
  }) => PagesReqResResponse;
};
type PagesRequestCookiesCarrier = {
  headers: {
    cookie?: string | string[] | null | undefined;
  };
  cookies?: unknown;
};
type CreatePagesReqResOptions = {
  body: unknown;
  query: PagesRequestQuery;
  request: Request;
  url: string;
};
type CreatePagesReqResResult = {
  req: PagesReqResRequest;
  res: PagesReqResResponse;
  responsePromise: Promise<Response>;
};
/**
 * Read and parse a Pages Router API request body for the Workers/prod path.
 *
 * `maxBytes` defaults to the 1 MB Next.js default but may be overridden by
 * `export const config = { api: { bodyParser: { sizeLimit: '4mb' } } }` on
 * the route module. Handlers that opt out entirely (`bodyParser: false`)
 * MUST skip this function so the body stream stays intact for user code.
 *
 * @see https://nextjs.org/docs/pages/building-your-application/routing/api-routes#custom-config
 */
declare function parsePagesApiBody(request: Request, maxBytes?: number): Promise<unknown>;
declare function getPagesPreviewData(request: Request, options?: {
  isOnDemandRevalidate?: boolean;
}): PagesPreviewData | false;
declare function attachPagesRequestCookies(req: PagesRequestCookiesCarrier): void;
declare function attachPagesPreviewApi(req: PagesReqResRequest, res: PagesReqResResponse): void;
declare function createPagesReqRes(options: CreatePagesReqResOptions): CreatePagesReqResResult;
//#endregion
export { PagesBodyParseError as PagesApiBodyParseError, PagesReqResRequest, PagesReqResResponse, PagesRequestQuery, attachPagesPreviewApi, attachPagesRequestCookies, createPagesReqRes, getPagesPreviewData, parsePagesApiBody };