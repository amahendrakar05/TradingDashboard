//#region src/server/app-rsc-embedded-chunks.ts
const RSC_EMBEDDED_BINARY_CHUNK = 3;
const BASE64_CHUNK_SIZE = 32768;
const textEncoder = new TextEncoder();
function bytesToBase64(bytes) {
	let binary = "";
	for (let offset = 0; offset < bytes.byteLength; offset += BASE64_CHUNK_SIZE) binary += String.fromCharCode(...bytes.subarray(offset, offset + BASE64_CHUNK_SIZE));
	return btoa(binary);
}
function base64ToBytes(base64) {
	const binary = atob(base64);
	const bytes = new Uint8Array(binary.length);
	for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
	return bytes;
}
function decodeRscEmbeddedChunk(chunk) {
	if (typeof chunk === "string") return textEncoder.encode(chunk);
	return base64ToBytes(chunk[1]);
}
function concatUint8Arrays(chunks) {
	let totalLength = 0;
	for (const chunk of chunks) totalLength += chunk.byteLength;
	const result = new Uint8Array(totalLength);
	let offset = 0;
	for (const chunk of chunks) {
		result.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return result;
}
//#endregion
export { RSC_EMBEDDED_BINARY_CHUNK, bytesToBase64, concatUint8Arrays, decodeRscEmbeddedChunk };
