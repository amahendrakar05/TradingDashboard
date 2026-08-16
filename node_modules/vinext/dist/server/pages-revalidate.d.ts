import { IncomingMessage } from "node:http";

//#region src/server/pages-revalidate.d.ts
type RevalidateOptions = {
  /**
   * Only revalidate the path if it was already generated (cached). Mirrors
   * Next.js's `unstable_onlyGenerated`: sets the
   * `x-prerender-revalidate-if-generated` header and makes a 404 response count
   * as a successful no-op rather than an error.
   */
  unstable_onlyGenerated?: boolean;
};
declare function performOnDemandRevalidate(source: IncomingMessage | Headers, urlPath: string, opts?: RevalidateOptions): Promise<void>;
//#endregion
export { RevalidateOptions, performOnDemandRevalidate };