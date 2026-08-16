//#region src/plugins/rsc-reference-validation-normalizer.ts
const REFERENCE_VALIDATION_ID_PREFIX = "\0virtual:vite-rsc/reference-validation?";
function parseReferenceValidationQuery(id) {
	const queryStart = id.indexOf("?");
	if (queryStart === -1) return null;
	return Object.fromEntries(new URLSearchParams(id.slice(queryStart + 1)));
}
function normalizeReferenceKey(id) {
	return id.replaceAll("\0", "__x00__");
}
function hasReference(referenceMetaMap, referenceId) {
	if (!referenceMetaMap || !referenceId) return false;
	const normalizedReferenceId = normalizeReferenceKey(referenceId);
	return Object.values(referenceMetaMap).some((meta) => normalizeReferenceKey(meta.referenceKey) === normalizedReferenceId);
}
/**
* @vitejs/plugin-rsc stores dev virtual client-reference keys in Vite's encoded
* `/@id/__x00__...` form, but React's SSR consumer can ask validation for the
* decoded `/@id/\0...` form. Treat those as equivalent and fall through to the
* upstream validator for all other invalid references.
*/
function createRscReferenceValidationNormalizerPlugin() {
	let rscApi;
	return {
		name: "vinext:rsc-reference-validation-normalizer",
		enforce: "pre",
		apply(_config, env) {
			return env.command === "serve" && env.isPreview !== true;
		},
		configResolved(config) {
			rscApi = config.plugins.find((plugin) => plugin.name === "rsc:minimal")?.api;
		},
		load: {
			filter: { id: /^\u0000virtual:vite-rsc\/reference-validation\?/ },
			handler(id) {
				if (!id.startsWith(REFERENCE_VALIDATION_ID_PREFIX)) return null;
				const query = parseReferenceValidationQuery(id);
				if (!query) return null;
				const manager = rscApi?.manager;
				if (query.type === "client" && hasReference(manager?.clientReferenceMetaMap, query.id)) return "export {}";
				if (query.type === "server" && hasReference(manager?.serverReferenceMetaMap, query.id)) return "export {}";
				return null;
			}
		}
	};
}
//#endregion
export { createRscReferenceValidationNormalizerPlugin };
