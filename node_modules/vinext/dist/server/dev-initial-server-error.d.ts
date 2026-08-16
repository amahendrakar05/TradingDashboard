//#region src/server/dev-initial-server-error.d.ts
type InitialDevServerErrorPayload = {
  message: string;
  name?: string;
  stack?: string;
};
declare function createInitialDevServerErrorScript(error: unknown, scriptNonce?: string, nodeEnv?: "development" | "production" | "test"): string;
//#endregion
export { InitialDevServerErrorPayload, createInitialDevServerErrorScript };