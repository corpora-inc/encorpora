/** Every error is logged: to the console and to a small on-device ring buffer (shared kit). */
import "./appkit.ts";
export { logError, loggedErrors, type LoggedError } from "../../../../harvest/appkit/src/log.ts";
