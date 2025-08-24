import { defaultNS } from "./i18n";

import "i18next";
// Import your default namespace file as a type
import type common from "../public/locales/en/common.json";

// Use a type alias to create a type for your resources object
type Resources = {
  common: typeof common;
};

// And then define the resources and default namespace for i18next
declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: typeof defaultNS;
    resources: Resources;
  }
}
