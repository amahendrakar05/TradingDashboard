//#region src/cli-dev-config.ts
function applyDevServerDefaults(server, options) {
	server.port = options.port ?? server.port ?? 3e3;
	server.host = options.hostname ?? server.host ?? "localhost";
}
function createDevServerConfigPlugin(options) {
	return {
		name: "vinext:dev-server-config",
		enforce: "post",
		config: {
			order: "post",
			handler(config) {
				applyDevServerDefaults(config.server ??= {}, options);
			}
		}
	};
}
function normalizeDevServerHostname(host) {
	if (typeof host === "string") return host;
	return host === true ? "0.0.0.0" : "localhost";
}
//#endregion
export { applyDevServerDefaults, createDevServerConfigPlugin, normalizeDevServerHostname };
