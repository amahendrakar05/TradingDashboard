import { ServerActionResultDecision } from "./navigation-planner.js";

//#region src/server/app-browser-server-action-navigation.d.ts
declare function applyServerActionResultDecision(decision: ServerActionResultDecision, clearCaches: () => void, performHardNavigation: (url: string, historyMode?: "assign" | "replace") => void): boolean;
//#endregion
export { applyServerActionResultDecision };