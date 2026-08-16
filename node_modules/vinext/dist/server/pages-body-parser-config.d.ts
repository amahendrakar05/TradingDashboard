//#region src/server/pages-body-parser-config.d.ts
/**
 * Resolve the Pages Router `api.bodyParser` config from a route module export.
 *
 * Next.js API routes can opt out of automatic body parsing or raise the
 * default 1 MB size limit:
 *
 *   export const config = { api: { bodyParser: false } };
 *   export const config = { api: { bodyParser: { sizeLimit: '4mb' } } };
 *
 * `bodyParser: false` is critical for webhook handlers (Stripe, GitHub,
 * Slack, etc.) that must read the raw request bytes to verify an HMAC
 * signature. Silently parsing the body would consume the stream and break
 * signature verification — usually failing closed, sometimes failing open.
 *
 * @see https://nextjs.org/docs/pages/building-your-application/routing/api-routes#custom-config
 * @see Next.js: packages/next/src/server/api-utils/node/api-resolver.ts
 *
 * The format of `sizeLimit` mirrors what Next.js accepts via the `bytes`
 * package: a number of bytes, or a string with a unit suffix
 * (`"500b"`, `"100kb"`, `"4mb"`, `"1gb"`).
 */
/**
 * Default Pages Router API body size limit, matching Next.js.
 */
declare const DEFAULT_PAGES_API_BODY_SIZE_LIMIT: number;
/**
 * Resolved bodyParser configuration. When `enabled` is `false`, the body
 * MUST be passed through to the handler as a raw stream (or left unparsed
 * with `req.body === undefined`), so user code can read it itself.
 */
type ResolvedBodyParserConfig = {
  enabled: false;
} | {
  enabled: true;
  sizeLimit: number;
};
/**
 * Parse a Next.js-style `sizeLimit` string (e.g. `"4mb"`, `"100kb"`, `"1gb"`)
 * or numeric byte value into a number of bytes. Returns `undefined` for
 * inputs that can't be parsed — callers should fall back to the default.
 *
 * Matches the format accepted by Next.js (the `bytes` package); we
 * implement it inline to avoid pulling a dependency for a tiny parser.
 */
declare function parseSizeLimit(value: string | number | undefined): number | undefined;
/**
 * Read the resolved `bodyParser` config from a route module's `config`
 * export. Defaults to enabled with the 1 MB Next.js default.
 */
declare function resolveBodyParserConfig(moduleConfig: {
  api?: {
    bodyParser?: boolean | {
      sizeLimit?: string | number;
    };
  };
} | undefined, defaultSizeLimit?: number): ResolvedBodyParserConfig;
//#endregion
export { DEFAULT_PAGES_API_BODY_SIZE_LIMIT, parseSizeLimit, resolveBodyParserConfig };