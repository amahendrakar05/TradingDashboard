//#region src/server/rsc-stream-hints.ts
const REACT_FLIGHT_STYLESHEET_PRELOAD_HINT = /^([0-9a-f]*:HL\[.*?),"stylesheet"(\]|,)/;
const STYLESHEET_TO_STYLE_JSON_PADDING = " ".repeat(5);
const LENGTH_PREFIXED_ROW_TAGS = /* @__PURE__ */ new Set([
	"T",
	"A",
	"O",
	"o",
	"b",
	"U",
	"S",
	"s",
	"L",
	"l",
	"G",
	"g",
	"M",
	"m",
	"V"
]);
const NEWLINE_PREFIXED_ROW_TAGS = /* @__PURE__ */ new Set([
	"I",
	"H",
	"E",
	"N",
	"D",
	"J",
	"W",
	"R",
	"r",
	"X",
	"x",
	"C",
	"P",
	"#"
]);
const decoder = new TextDecoder();
const encoder = new TextEncoder();
/** Rewrite only a complete React Flight stylesheet hint row. */
function normalizeReactFlightHintLine(line) {
	const text = decoder.decode(line);
	const normalized = text.replace(REACT_FLIGHT_STYLESHEET_PRELOAD_HINT, `$1,"style"${STYLESHEET_TO_STYLE_JSON_PADDING}$2`);
	if (normalized === text) return line;
	const normalizedBytes = encoder.encode(normalized);
	return normalizedBytes.byteLength === line.byteLength ? normalizedBytes : line;
}
function concatBytes(first, second) {
	if (first.byteLength === 0) return second;
	const combined = new Uint8Array(first.byteLength + second.byteLength);
	combined.set(first);
	combined.set(second, first.byteLength);
	return combined;
}
function indexOfByte(bytes, byte, from = 0) {
	for (let index = from; index < bytes.byteLength; index++) if (bytes[index] === byte) return index;
	return -1;
}
function parseHexBytes(bytes, start, end) {
	if (start === end) return null;
	let value = 0;
	for (let index = start; index < end; index++) {
		const byte = bytes[index];
		const digit = byte >= 48 && byte <= 57 ? byte - 48 : byte >= 97 && byte <= 102 ? byte - 87 : -1;
		if (digit === -1) return null;
		value = value * 16 + digit;
		if (!Number.isSafeInteger(value)) return null;
	}
	return value;
}
function isUntaggedJsonRowStart(byte) {
	return byte === 34 || byte === 45 || byte >= 48 && byte <= 57 || byte === 91 || byte === 102 || byte === 110 || byte === 116 || byte === 123;
}
function normalizeReactFlightPreloadHints(stream) {
	let carry = /* @__PURE__ */ new Uint8Array();
	let rawBytesRemaining = 0;
	let passThrough = false;
	return stream.pipeThrough(new TransformStream({
		transform(chunk, controller) {
			if (passThrough) {
				controller.enqueue(chunk);
				return;
			}
			let bytes = concatBytes(carry, chunk);
			carry = /* @__PURE__ */ new Uint8Array();
			while (bytes.byteLength > 0) {
				if (rawBytesRemaining > 0) {
					const length = Math.min(rawBytesRemaining, bytes.byteLength);
					controller.enqueue(bytes.slice(0, length));
					rawBytesRemaining -= length;
					bytes = bytes.subarray(length);
					continue;
				}
				const colon = indexOfByte(bytes, 58);
				if (colon === -1 || colon + 1 === bytes.byteLength) {
					carry = bytes.slice();
					return;
				}
				const tag = String.fromCharCode(bytes[colon + 1]);
				if (LENGTH_PREFIXED_ROW_TAGS.has(tag)) {
					const comma = indexOfByte(bytes, 44, colon + 2);
					if (comma === -1) {
						carry = bytes.slice();
						return;
					}
					const length = parseHexBytes(bytes, colon + 2, comma);
					if (length != null) {
						controller.enqueue(bytes.slice(0, comma + 1));
						rawBytesRemaining = length;
						bytes = bytes.subarray(comma + 1);
						continue;
					}
					passThrough = true;
					controller.enqueue(bytes);
					return;
				}
				const tagByte = bytes[colon + 1];
				if (!NEWLINE_PREFIXED_ROW_TAGS.has(tag) && !isUntaggedJsonRowStart(tagByte)) {
					passThrough = true;
					controller.enqueue(bytes);
					return;
				}
				const newline = indexOfByte(bytes, 10);
				if (newline === -1) {
					carry = bytes.slice();
					return;
				}
				controller.enqueue(normalizeReactFlightHintLine(bytes.slice(0, newline + 1)));
				bytes = bytes.subarray(newline + 1);
			}
		},
		flush(controller) {
			if (carry.byteLength > 0) controller.enqueue(rawBytesRemaining > 0 ? carry : normalizeReactFlightHintLine(carry));
		}
	}));
}
function createRscRenderer(render) {
	return (model, options) => normalizeReactFlightPreloadHints(render(model, options));
}
function createRscPrerenderer(prerender) {
	return async (model, options) => {
		return { prelude: normalizeReactFlightPreloadHints((await prerender(model, options)).prelude) };
	};
}
//#endregion
export { createRscPrerenderer, createRscRenderer, normalizeReactFlightPreloadHints };
