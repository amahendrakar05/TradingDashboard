import { normalizeClientInstrumentationHooks, setClientInstrumentationHooks } from "./instrumentation-client-state.js";
import * as instrumentationClientHooks from "private-next-instrumentation-client";
//#region src/client/instrumentation-client.ts
const clientInstrumentationHooks = setClientInstrumentationHooks(normalizeClientInstrumentationHooks(instrumentationClientHooks));
//#endregion
export { clientInstrumentationHooks };
