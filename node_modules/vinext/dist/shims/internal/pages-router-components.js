//#region src/shims/internal/pages-router-components.ts
const COMPONENTS_KEY = Symbol.for("vinext.pagesRouter.components");
function getPagesRouterComponentsMap() {
	const globalState = globalThis;
	let components = globalState[COMPONENTS_KEY];
	if (!components) {
		components = {};
		globalState[COMPONENTS_KEY] = components;
	}
	return components;
}
//#endregion
export { getPagesRouterComponentsMap };
