//#region src/server/app-client-reference-preloader.d.ts
type ClientReferenceRequire = (id: string) => Promise<unknown>;
type ClientReferenceMap = Readonly<Record<string, unknown>>;
type ClientReferencePreloaderOptions = {
  getReferences: () => ClientReferenceMap | undefined;
  getClientRequire: () => ClientReferenceRequire | undefined;
  onPreloadError?: (id: string, error: unknown) => void;
};
type ClientReferencePreloader = {
  preload: (referenceIds?: Iterable<string>) => Promise<void>;
};
declare function createClientReferencePreloader(options: ClientReferencePreloaderOptions): ClientReferencePreloader;
//#endregion
export { createClientReferencePreloader };