import { Plugin } from "vite";

//#region src/plugins/rsc-reference-validation-normalizer.d.ts
/**
 * @vitejs/plugin-rsc stores dev virtual client-reference keys in Vite's encoded
 * `/@id/__x00__...` form, but React's SSR consumer can ask validation for the
 * decoded `/@id/\0...` form. Treat those as equivalent and fall through to the
 * upstream validator for all other invalid references.
 */
declare function createRscReferenceValidationNormalizerPlugin(): Plugin;
//#endregion
export { createRscReferenceValidationNormalizerPlugin };