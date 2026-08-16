import { extract as vercelExtract, generate as vercelGenerate, } from "./vercel.js";
import { createExtractAndGenerate } from "../utils.js";
export const generate = (src, operations, options = {}) => vercelGenerate(src, operations, { ...options, prefix: "_next" });
export const extract = (url, options) => vercelExtract(url, options);
export const transform = createExtractAndGenerate(extract, generate);
