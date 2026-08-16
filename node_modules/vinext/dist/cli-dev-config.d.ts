import { Plugin, ServerOptions } from "vite";

//#region src/cli-dev-config.d.ts
type DevServerCliOptions = {
  port?: number;
  hostname?: string;
};
declare function applyDevServerDefaults(server: ServerOptions, options: DevServerCliOptions): void;
declare function createDevServerConfigPlugin(options: DevServerCliOptions): Plugin;
declare function normalizeDevServerHostname(host: string | boolean | undefined): string;
//#endregion
export { DevServerCliOptions, applyDevServerDefaults, createDevServerConfigPlugin, normalizeDevServerHostname };