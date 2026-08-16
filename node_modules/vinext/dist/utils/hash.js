//#region src/utils/hash.ts
/**
* FNV-1a hash producing a 64-bit result (two 32-bit rounds with different seeds).
* Used for deterministic key generation where collisions must be rare.
*
* This is a vinext-internal format: nothing outside vinext ever compares
* these values, so the algorithm only needs to be deterministic. For values
* that must be byte-for-byte identical to what Next.js emits (ETags), use
* `fnv1a52` below instead — the two are NOT interchangeable.
*/
function fnv1a64(input) {
	let h1 = 2166136261;
	for (let i = 0; i < input.length; i++) {
		h1 ^= input.charCodeAt(i);
		h1 = h1 * 16777619 >>> 0;
	}
	let h2 = 84696351;
	for (let i = 0; i < input.length; i++) {
		h2 ^= input.charCodeAt(i);
		h2 = h2 * 16777619 >>> 0;
	}
	return h1.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0");
}
/**
* FNV-1a hash producing a 52-bit result, a byte-for-byte port of Next.js's
* `fnv1a52` in packages/next/src/server/lib/etag.ts (itself derived from
* fnv-plus). Used for ETag generation, where matching Next.js's exact output
* matters: clients and CDNs holding `If-None-Match` values from a Next.js
* deployment keep revalidating (304) against vinext for unchanged payloads.
*
* Deliberately separate from `fnv1a64` above — that one is a vinext-internal
* key format and produces different values. Do not swap one for the other.
*/
function fnv1a52(str) {
	const len = str.length;
	let i = 0, t0 = 0, v0 = 8997, t1 = 0, v1 = 33826, t2 = 0, v2 = 40164, t3 = 0, v3 = 52210;
	while (i < len) {
		v0 ^= str.charCodeAt(i++);
		t0 = v0 * 435;
		t1 = v1 * 435;
		t2 = v2 * 435;
		t3 = v3 * 435;
		t2 += v0 << 8;
		t3 += v1 << 8;
		t1 += t0 >>> 16;
		v0 = t0 & 65535;
		t2 += t1 >>> 16;
		v1 = t1 & 65535;
		v3 = t3 + (t2 >>> 16) & 65535;
		v2 = t2 & 65535;
	}
	return (v3 & 15) * 281474976710656 + v2 * 4294967296 + v1 * 65536 + (v0 ^ v3 >> 4);
}
//#endregion
export { fnv1a52, fnv1a64 };
