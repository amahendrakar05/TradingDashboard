//#region src/server/pages-serializable-props.ts
/**
* Validate that the value returned as `props` from `getStaticProps` /
* `getServerSideProps` is JSON-serializable. Throws a friendly
* `SerializableError` matching Next.js's error shape if it isn't.
*
* Ported from Next.js:
*   .nextjs-ref/packages/next/src/lib/is-serializable-props.ts
*   .nextjs-ref/packages/next/src/shared/lib/is-plain-object.ts
*
* Tested in Next.js by `test/unit/is-serializable-props.test.ts` and the
* `non-json` / `non-json-blocking` cases in `test/e2e/prerender.test.ts`.
*
* Next.js calls this from `packages/next/src/server/render.tsx` for both
* `getStaticProps` and `getServerSideProps`. We do the same in
* `pages-page-data.ts` so users see a clear error instead of an empty page
* when they accidentally return a `Date`, `Map`, or class instance.
*/
function getObjectClassLabel(value) {
	return Object.prototype.toString.call(value);
}
function isPlainObject(value) {
	if (getObjectClassLabel(value) !== "[object Object]") return false;
	const prototype = Object.getPrototypeOf(value);
	return prototype === null || Object.prototype.hasOwnProperty.call(prototype, "isPrototypeOf");
}
const REGEX_PLAIN_IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
var SerializableError = class extends Error {
	constructor(page, method, path, message) {
		super(path ? `Error serializing \`${path}\` returned from \`${method}\` in "${page}".\nReason: ${message}` : `Error serializing props returned from \`${method}\` in "${page}".\nReason: ${message}`);
		this.name = "SerializableError";
	}
};
function isSerializableProps(page, method, input) {
	if (!isPlainObject(input)) throw new SerializableError(page, method, "", `Props must be returned as a plain object from ${method}: \`{ props: { ... } }\` (received: \`${getObjectClassLabel(input)}\`).`);
	function visit(visited, value, path) {
		if (visited.has(value)) throw new SerializableError(page, method, path, `Circular references cannot be expressed in JSON (references: \`${visited.get(value) || "(self)"}\`).`);
		visited.set(value, path);
	}
	function isSerializable(refs, value, path) {
		const type = typeof value;
		if (value === null || type === "boolean" || type === "number" || type === "string") return true;
		if (type === "undefined") throw new SerializableError(page, method, path, "`undefined` cannot be serialized as JSON. Please use `null` or omit this value.");
		if (isPlainObject(value)) {
			visit(refs, value, path);
			const entries = Object.entries(value);
			for (const [key, nestedValue] of entries) {
				const nextPath = REGEX_PLAIN_IDENTIFIER.test(key) ? `${path}.${key}` : `${path}[${JSON.stringify(key)}]`;
				const newRefs = new Map(refs);
				isSerializable(newRefs, key, nextPath);
				isSerializable(newRefs, nestedValue, nextPath);
			}
			return true;
		}
		if (Array.isArray(value)) {
			visit(refs, value, path);
			value.forEach((nestedValue, index) => {
				isSerializable(new Map(refs), nestedValue, `${path}[${index}]`);
			});
			return true;
		}
		throw new SerializableError(page, method, path, `\`${type}\`${type === "object" ? ` ("${Object.prototype.toString.call(value)}")` : ""} cannot be serialized as JSON. Please only return JSON serializable data types.`);
	}
	return isSerializable(/* @__PURE__ */ new Map(), input, "");
}
//#endregion
export { SerializableError, isSerializableProps };
