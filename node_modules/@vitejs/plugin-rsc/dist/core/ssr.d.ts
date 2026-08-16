import { u as ServerConsumerManifest } from "../index-D2a5dlVU.js";

//#region src/core/ssr.d.ts
declare function setRequireModule(options: {
  load: (id: string) => unknown;
}): void;
declare function createServerConsumerManifest(): ServerConsumerManifest;
//#endregion
export { createServerConsumerManifest, setRequireModule };