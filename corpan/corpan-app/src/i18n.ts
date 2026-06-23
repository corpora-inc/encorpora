import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import Backend from "i18next-http-backend";

export const defaultNS = "common";

i18n
  // load translation using http -> see /public/locales (i.e. https://github.com/i18next/i18next-http-backend)
  .use(Backend)
  // pass the i18n instance to react-i18next.
  .use(initReactI18next)
  // init i18next
  // for all options read: https://www.i18next.com/overview/configuration-options
  .init({
    fallbackLng: "en", // use 'en' if the user's language is not available
    debug: !import.meta.env.PROD,
    load: "currentOnly", // only load the exact language code (e.g., "zh-Hans"), don't try base ("zh") first

    interpolation: {
      escapeValue: false, // not needed for react as it escapes by default
    },

    backend: {
      loadPath: "/locales/{{lng}}/{{ns}}.json",
    },

    ns: ["common"],
    defaultNS,
  });

// Expose the i18next instance globally so packs running in the same WebView
// (reader packs loaded via game-proxy) can call `window.__corpanI18n.t(...)`
// without importing this module. The packs run in the same window as the
// main app but are separate bundles.
;(window as unknown as { __corpanI18n?: typeof i18n }).__corpanI18n = i18n

export default i18n;
