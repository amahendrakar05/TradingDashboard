//#region src/plugins/rsc-client-reference-loaders.ts
const CLIENT_REFERENCES_ID = "\0virtual:vite-rsc/client-references";
const RESOLVED_ID_PROXY_PREFIX = "virtual:vite-rsc/resolved-id/";
function withResolvedIdProxy(resolvedId) {
	return resolvedId.startsWith("\0") ? RESOLVED_ID_PROXY_PREFIX + encodeURIComponent(resolvedId) : resolvedId;
}
function generateClientReferenceObject(meta) {
	const exports = meta.renderedExports.slice().sort().map((name) => `      get ${JSON.stringify(name)}() { return m[${JSON.stringify(name)}]; },`).join("\n");
	return exports ? `{\n${exports}\n    }` : "{}";
}
function generateDirectClientReferenceLoaders(metas) {
	return `export default {\n${metas.slice().sort((a, b) => a.referenceKey.localeCompare(b.referenceKey)).map((meta) => {
		const importId = withResolvedIdProxy(meta.importId);
		return [
			`  ${JSON.stringify(meta.referenceKey)}: async () => {`,
			`    const m = await import(${JSON.stringify(importId)});`,
			`    return ${generateClientReferenceObject(meta)};`,
			`  },`
		].join("\n");
	}).join("\n")}\n};\n`;
}
function createRscClientReferenceLoadersPlugin() {
	let rscApi;
	return {
		name: "vinext:rsc-client-reference-loaders",
		enforce: "post",
		configResolved(config) {
			rscApi = config.plugins.find((plugin) => plugin.name === "rsc:minimal")?.api;
		},
		transform(_code, id) {
			if (id !== CLIENT_REFERENCES_ID) return null;
			const manager = rscApi?.manager;
			if (!manager || manager.isScanBuild) return null;
			const metaEntries = Object.entries(manager.clientReferenceMetaMap).filter(([, meta]) => meta.serverChunk);
			const metas = metaEntries.map(([, meta]) => meta);
			if (metas.length === 0) return null;
			for (const [id, meta] of metaEntries) meta.groupChunkId = id;
			return {
				code: generateDirectClientReferenceLoaders(metas),
				map: null
			};
		}
	};
}
//#endregion
export { createRscClientReferenceLoadersPlugin };
