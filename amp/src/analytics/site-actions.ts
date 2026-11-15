import { z } from "zod";
import { MARKETING_SCREENS, SITE_ACTIONS } from "./site-categories.js";
export { MARKETING_SCREENS, SITE_ACTIONS, marketingScreen } from "./site-categories.js";

export const siteActionSchema = z.strictObject({
  eventId: z.uuidv4(),
  action: z.enum(SITE_ACTIONS),
  screen: z.enum(MARKETING_SCREENS),
});
