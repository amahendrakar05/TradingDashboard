//#region src/utils/redirect-digest.d.ts
type RedirectDigest = {
  status: number;
  type: string | null;
  url: string;
};
declare function parseRedirectDigest(digest: string): RedirectDigest | null;
//#endregion
export { RedirectDigest, parseRedirectDigest };