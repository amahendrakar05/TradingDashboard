//#region src/server/pages-body-parser-config.ts
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
const DEFAULT_PAGES_API_BODY_SIZE_LIMIT = 1 * 1024 * 1024;
const SIZE_UNITS = {
	b: 1,
	kb: 1024,
	mb: 1024 * 1024,
	gb: 1024 * 1024 * 1024,
	tb: 1024 * 1024 * 1024 * 1024
};
/**
* Parse a Next.js-style `sizeLimit` string (e.g. `"4mb"`, `"100kb"`, `"1gb"`)
* or numeric byte value into a number of bytes. Returns `undefined` for
* inputs that can't be parsed — callers should fall back to the default.
*
* Matches the format accepted by Next.js (the `bytes` package); we
* implement it inline to avoid pulling a dependency for a tiny parser.
*/
function parseSizeLimit(value) {
	if (value === void 0 || value === null) return void 0;
	if (typeof value === "number") return Number.isFinite(value) && value >= 0 ? value : void 0;
	if (typeof value !== "string") return void 0;
	const trimmed = value.trim().toLowerCase();
	if (!trimmed) return void 0;
	const match = /^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb|tb)?$/.exec(trimmed);
	if (!match) return void 0;
	const amount = Number.parseFloat(match[1]);
	if (!Number.isFinite(amount) || amount < 0) return void 0;
	const unit = match[2] ?? "b";
	const multiplier = SIZE_UNITS[unit];
	if (multiplier === void 0) return void 0;
	return Math.floor(amount * multiplier);
}
/**
* Read the resolved `bodyParser` config from a route module's `config`
* export. Defaults to enabled with the 1 MB Next.js default.
*/
function resolveBodyParserConfig(moduleConfig, defaultSizeLimit = DEFAULT_PAGES_API_BODY_SIZE_LIMIT) {
	const bodyParser = moduleConfig?.api?.bodyParser;
	if (bodyParser === false) return { enabled: false };
	if (bodyParser === void 0 || bodyParser === true) return {
		enabled: true,
		sizeLimit: defaultSizeLimit
	};
	if (typeof bodyParser === "object" && bodyParser !== null) return {
		enabled: true,
		sizeLimit: parseSizeLimit(bodyParser.sizeLimit) ?? defaultSizeLimit
	};
	return {
		enabled: true,
		sizeLimit: defaultSizeLimit
	};
}
//#endregion
export { DEFAULT_PAGES_API_BODY_SIZE_LIMIT, parseSizeLimit, resolveBodyParserConfig };
