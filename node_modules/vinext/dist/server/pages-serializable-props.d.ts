//#region src/server/pages-serializable-props.d.ts
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
declare class SerializableError extends Error {
  constructor(page: string, method: string, path: string, message: string);
}
declare function isSerializableProps(page: string, method: string, input: unknown): true;
//#endregion
export { SerializableError, isSerializableProps };