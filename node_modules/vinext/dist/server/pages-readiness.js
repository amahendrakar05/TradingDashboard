//#region src/server/pages-readiness.ts
/**
* Build the readiness flags for a Pages Router render. Shared by the dev and
* production Pages render paths.
*/
function buildPagesReadinessNextData(options) {
	const hasPageGssp = typeof options.pageModule.getServerSideProps === "function";
	const hasPageGsp = typeof options.pageModule.getStaticProps === "function";
	const hasPageGip = typeof options.pageModule.default?.getInitialProps === "function";
	const hasAppGip = typeof options.appComponent?.getInitialProps === "function" && options.appComponent.getInitialProps !== options.appComponent.origGetInitialProps;
	const autoExport = !hasPageGssp && !hasPageGsp && !hasPageGip && !hasAppGip;
	return {
		gssp: hasPageGssp,
		gsp: hasPageGsp ? true : void 0,
		gip: hasPageGip,
		appGip: hasAppGip,
		autoExport,
		nextExport: autoExport ? true : void 0,
		__vinext: { hasRewrites: options.hasRewrites }
	};
}
//#endregion
export { buildPagesReadinessNextData };
